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
const fs = require("fs");
const multer = require("multer");
const db = require("../db");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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
  "mileage", "condition_note", "description", "image_url", "tags",
];

router.get("/vehicles", (req, res) => {
  res.json({ vehicles: db.prepare("SELECT * FROM vehicles ORDER BY created_at DESC").all() });
});

router.post("/vehicles", (req, res) => {
  const data = withDefaults(pick(req.body, vehicleFields), vehicleFields);
  if (!data.title || !["local", "export"].includes(data.category)) {
    return res.status(400).json({ error: "Title and a valid category ('local' or 'export') are required." });
  }
  const info = db.prepare(`
    INSERT INTO vehicles (category, title, price, year, make, model, mileage, condition_note, description, image_url, tags)
    VALUES (@category, @title, @price, @year, @make, @model, @mileage, @condition_note, @description, @image_url, @tags)
  `).run(data);
  res.status(201).json({ vehicle: db.prepare("SELECT * FROM vehicles WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/vehicles/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Vehicle not found." });
  const data = withDefaults(pick(req.body, vehicleFields), vehicleFields, existing);
  db.prepare(`
    UPDATE vehicles SET category=@category, title=@title, price=@price, year=@year, make=@make, model=@model,
      mileage=@mileage, condition_note=@condition_note, description=@description, image_url=@image_url, tags=@tags
    WHERE id=@id
  `).run({ ...data, id: req.params.id });
  res.json({ vehicle: db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id) });
});

router.delete("/vehicles/:id", (req, res) => {
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
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
  db.prepare("DELETE FROM parts WHERE id = ?").run(req.params.id);
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

module.exports = router;
