// admin.js — authenticated admin endpoints for managing listings across
// all four site sections (local cars, export/salvage cars, parts, and
// the daily auction feed), including photo uploads.
//
// Every route in this file requires an active session belonging to a
// user whose `role` is 'admin'. There is no public sign-up path to
// become an admin — see README.md for how to grant the first admin
// account via the ADMIN_BOOTSTRAP_EMAIL environment variable.

const express = require("express");
const path = require("path");
const multer = require("multer");
const db = require("../db");
const { uploadsDir } = require("../paths");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per photo
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
  },
});

// A vehicle listing can carry several photos (mirrors the community
// Parts Seller upload limit in server/routes/seller.js).
const MAX_VEHICLE_PHOTOS = 12;
const uploadMultiple = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_VEHICLE_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
  },
});

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in." });
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

router.use(requireAdmin);

router.get("/check", (req, res) => res.json({ ok: true }));

router.post("/upload", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No image file received." });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// Multiple photos in one request — used by the Local Cars / Export
// listing forms. Returns the uploaded URLs in the same order the files
// were sent (mirrors POST /api/seller/upload for community part sellers).
router.post("/vehicles/upload", (req, res) => {
  uploadMultiple.array("images", MAX_VEHICLE_PHOTOS)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || !req.files.length) return res.status(400).json({ error: "No image files received." });
    res.json({ urls: req.files.map((f) => `/uploads/${f.filename}`) });
  });
});

// ---- Site settings (the homepage's three hero-slide banners) ----

const settingsKeys = [
  "banner_image_url", "banner_headline", "banner_subtext",
  "parts_banner_image_url",
  "export_banner_image_url",
];

function readSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}

router.get("/settings", (req, res) => {
  res.json({ settings: readSettings() });
});

router.put("/settings", (req, res) => {
  const data = req.body || {};
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const applyAll = db.transaction(() => {
    for (const key of settingsKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key] == null ? "" : String(data[key]).trim();
        upsert.run({ key, value });
      }
    }
  });
  applyAll();
  res.json({ settings: readSettings() });
});

// ---- helpers ----

function pick(obj, fields) {
  const out = {};
  for (const f of fields) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  }
  return out;
}

function withDefaults(data, fields, existing) {
  const out = {};
  for (const f of fields) {
    let v = data[f];
    if (v === undefined) v = existing ? existing[f] : null;
    if (v === "") v = null;
    out[f] = v;
  }
  return out;
}

// ---- Vehicles (local + export share one table, split by `category`) ----

const vehicleFields = [
  "category", "title", "price", "year", "make", "model",
  "mileage", "condition_note", "body_type", "description", "image_url", "tags",
];

// ---- Vehicle photos (multiple per listing) --------------------------
// Mirrors partWithImages/replaceImages in server/routes/seller.js:
// vehicles.image_url stays a "primary photo" convenience column, kept in
// sync with the first row in vehicle_images, so the homepage/inventory
// grids (which only ever read image_url) keep showing one photo per
// vehicle without any change on their end.

function vehicleWithImages(id) {
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) return null;
  const images = db
    .prepare("SELECT image_url FROM vehicle_images WHERE vehicle_id = ? ORDER BY sort_order ASC, id ASC")
    .all(id)
    .map((i) => i.image_url);
  return { ...vehicle, images: images.length ? images : vehicle.image_url ? [vehicle.image_url] : [] };
}

function replaceVehicleImages(vehicleId, urls) {
  const clean = (urls || []).filter((u) => typeof u === "string" && u.trim()).slice(0, MAX_VEHICLE_PHOTOS);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM vehicle_images WHERE vehicle_id = ?").run(vehicleId);
    const insert = db.prepare(
      "INSERT INTO vehicle_images (vehicle_id, image_url, sort_order) VALUES (?, ?, ?)"
    );
    clean.forEach((url, i) => insert.run(vehicleId, url, i));
    db.prepare("UPDATE vehicles SET image_url = ? WHERE id = ?").run(clean[0] || null, vehicleId);
  });
  tx();
}

router.get("/vehicles", (req, res) => {
  const rows = db.prepare("SELECT id FROM vehicles ORDER BY created_at DESC").all();
  res.json({ vehicles: rows.map((r) => vehicleWithImages(r.id)) });
});

router.post("/vehicles", (req, res) => {
  const data = withDefaults(pick(req.body, vehicleFields), vehicleFields);
  if (!data.title || !["local", "export"].includes(data.category)) {
    return res.status(400).json({ error: "Title and a valid category ('local' or 'export') are required." });
  }
  const info = db.prepare(`
    INSERT INTO vehicles (category, title, price, year, make, model, mileage, condition_note, body_type, description, image_url, tags)
    VALUES (@category, @title, @price, @year, @make, @model, @mileage, @condition_note, @body_type, @description, @image_url, @tags)
  `).run(data);
  if (Array.isArray(req.body.images)) replaceVehicleImages(info.lastInsertRowid, req.body.images);
  res.status(201).json({ vehicle: vehicleWithImages(info.lastInsertRowid) });
});

router.put("/vehicles/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Vehicle not found." });
  const data = withDefaults(pick(req.body, vehicleFields), vehicleFields, existing);
  db.prepare(`
    UPDATE vehicles SET category=@category, title=@title, price=@price, year=@year, make=@make, model=@model,
      mileage=@mileage, condition_note=@condition_note, body_type=@body_type, description=@description, image_url=@image_url, tags=@tags
    WHERE id=@id
  `).run({ ...data, id: req.params.id });
  if (Array.isArray(req.body.images)) replaceVehicleImages(req.params.id, req.body.images);
  res.json({ vehicle: vehicleWithImages(req.params.id) });
});

router.delete("/vehicles/:id", (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM vehicle_images WHERE vehicle_id = ?").run(req.params.id);
    db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
  });
  tx();
  res.json({ ok: true });
});

// ---- Parts ----

const partFields = [
  "title", "category", "make_compat", "model_compat",
  "condition_note", "price", "quantity", "description", "image_url",
];

router.get("/parts", (req, res) => {
  res.json({ parts: db.prepare("SELECT * FROM parts ORDER BY created_at DESC").all() });
});

router.post("/parts", (req, res) => {
  const data = withDefaults(pick(req.body, partFields), partFields);
  if (!data.title) return res.status(400).json({ error: "Title is required." });
  const info = db.prepare(`
    INSERT INTO parts (title, category, make_compat, model_compat, condition_note, price, quantity, description, image_url)
    VALUES (@title, @category, @make_compat, @model_compat, @condition_note, @price, @quantity, @description, @image_url)
  `).run(data);
  res.status(201).json({ part: db.prepare("SELECT * FROM parts WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/parts/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM parts WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Part not found." });
  const data = withDefaults(pick(req.body, partFields), partFields, existing);
  db.prepare(`
    UPDATE parts SET title=@title, category=@category, make_compat=@make_compat, model_compat=@model_compat,
      condition_note=@condition_note, price=@price, quantity=@quantity, description=@description, image_url=@image_url
    WHERE id=@id
  `).run({ ...data, id: req.params.id });
  res.json({ part: db.prepare("SELECT * FROM parts WHERE id = ?").get(req.params.id) });
});

router.delete("/parts/:id", (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM part_images WHERE part_id = ?").run(req.params.id);
    db.prepare("DELETE FROM parts WHERE id = ?").run(req.params.id);
  });
  tx();
  res.json({ ok: true });
});

// ---- Auctions ----

const auctionFields = [
  "title", "year", "make", "model", "image_url",
  "auction_source", "auction_url", "close_time",
];

router.get("/auctions", (req, res) => {
  res.json({ auctions: db.prepare("SELECT * FROM auctions ORDER BY created_at DESC").all() });
});

router.post("/auctions", (req, res) => {
  const data = withDefaults(pick(req.body, auctionFields), auctionFields);
  if (!data.title || !data.auction_url) {
    return res.status(400).json({ error: "Title and auction URL are required." });
  }
  const info = db.prepare(`
    INSERT INTO auctions (title, year, make, model, image_url, auction_source, auction_url, close_time)
    VALUES (@title, @year, @make, @model, @image_url, @auction_source, @auction_url, @close_time)
  `).run(data);
  res.status(201).json({ auction: db.prepare("SELECT * FROM auctions WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/auctions/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM auctions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Auction not found." });
  const data = withDefaults(pick(req.body, auctionFields), auctionFields, existing);
  db.prepare(`
    UPDATE auctions SET title=@title, year=@year, make=@make, model=@model, image_url=@image_url,
      auction_source=@auction_source, auction_url=@auction_url, close_time=@close_time
    WHERE id=@id
  `).run({ ...data, id: req.params.id });
  res.json({ auction: db.prepare("SELECT * FROM auctions WHERE id = ?").get(req.params.id) });
});

router.delete("/auctions/:id", (req, res) => {
  db.prepare("DELETE FROM auctions WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Read-only: every registered account, across all three buyer categories
// (local / trade / overseas — see the CHECK-free buyer_type column in
// db.js). Powers the Customers tab in the admin panel. password_hash is
// never selected — nothing in this route ever exposes it.
router.get("/users", (req, res) => {
  res.json({
    users: db
      .prepare(
        `SELECT id, name, email, phone, buyer_type, role, is_seller, created_at
         FROM users
         ORDER BY created_at DESC`
      )
      .all(),
  });
});

module.exports = router;
