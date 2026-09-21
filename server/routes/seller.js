// seller.js — the community Parts Seller portal: lets a logged-in member
// who has registered as a seller (users.is_seller = 1) list, edit, and
// remove their own car-parts listings, with photo uploads. This is
// deliberately separate from admin.js: a seller can only ever see/touch
// their OWN rows (every query is scoped by seller_id = req.session.userId),
// whereas admin.js can touch every listing in every section.

const express = require("express");
const path = require("path");
const multer = require("multer");
const db = require("../db");
const { uploadsDir } = require("../paths");

const router = express.Router();

const FUEL_TYPES = ["gas", "hybrid", "ev"];
const CONDITIONS = ["new", "used"];
const STATUSES = ["active", "sold", "removed"];
const MAX_PHOTOS = 8;

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
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_PHOTOS }, // 10MB per photo
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
  },
});

function requireSeller(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in." });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  if (!user.is_seller) {
    return res.status(403).json({ error: "Register as a Parts Seller first (see your Account page)." });
  }
  req.sellerUser = user;
  next();
}

router.use(requireSeller);

router.get("/check", (req, res) => res.json({ ok: true, user: req.sellerUser }));

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Lets a seller update their payout PayPal email / phone / postal code
// later (e.g. they made a typo at signup, or want payouts to go somewhere
// else) without re-registering. All three are required — a blank PayPal
// email would silently stop future sales from paying out at all.
router.put("/payout-info", (req, res) => {
  const { phone, paypal_email, postal_code } = req.body || {};
  if (!String(phone || "").trim()) return res.status(400).json({ error: "A contact phone number is required." });
  if (!isValidEmail(paypal_email)) return res.status(400).json({ error: "A valid PayPal email is required." });
  if (!String(postal_code || "").trim()) return res.status(400).json({ error: "A postal code is required." });
  db.prepare("UPDATE users SET phone = ?, paypal_email = ?, postal_code = ? WHERE id = ?").run(
    String(phone).trim(),
    String(paypal_email).trim().toLowerCase(),
    String(postal_code).trim(),
    req.sellerUser.id
  );
  res.json({
    user: db
      .prepare("SELECT id, name, email, phone, paypal_email, postal_code, is_seller FROM users WHERE id = ?")
      .get(req.sellerUser.id),
  });
});

// This seller's sales — what sold, for how much, and whether their payout
// went through, so they don't have to ask AFCA to find out.
router.get("/orders", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, part_id, part_title, part_price, fulfillment_method, shipping_fee, seller_payout,
              status, created_at
       FROM orders WHERE seller_id = ? ORDER BY created_at DESC`
    )
    .all(req.sellerUser.id);
  res.json({ orders: rows });
});

// Multiple photos in one request — used by the "Add a part" form. Returns
// the uploaded URLs in the same order the files were sent.
router.post("/upload", (req, res) => {
  upload.array("images", MAX_PHOTOS)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || !req.files.length) return res.status(400).json({ error: "No image files received." });
    res.json({ urls: req.files.map((f) => `/uploads/${f.filename}`) });
  });
});

function partWithImages(id) {
  const part = db.prepare("SELECT * FROM parts WHERE id = ?").get(id);
  if (!part) return null;
  const images = db
    .prepare("SELECT id, image_url FROM part_images WHERE part_id = ? ORDER BY sort_order ASC, id ASC")
    .all(id);
  return { ...part, images: images.map((i) => i.image_url), image_ids: images };
}

function replaceImages(partId, urls) {
  const clean = (urls || []).filter((u) => typeof u === "string" && u.trim()).slice(0, MAX_PHOTOS);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM part_images WHERE part_id = ?").run(partId);
    const insert = db.prepare(
      "INSERT INTO part_images (part_id, image_url, sort_order) VALUES (?, ?, ?)"
    );
    clean.forEach((url, i) => insert.run(partId, url, i));
    db.prepare("UPDATE parts SET image_url = ? WHERE id = ?").run(clean[0] || null, partId);
  });
  tx();
}

router.get("/parts", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM parts WHERE seller_id = ? ORDER BY created_at DESC")
    .all(req.sellerUser.id);
  res.json({ parts: rows.map((r) => partWithImages(r.id)) });
});

function validatePayload(body) {
  const title = String(body.title || "").trim();
  if (!title) return "A part name is required.";
  if (body.fuel_type && !FUEL_TYPES.includes(body.fuel_type)) {
    return "Fuel/power type must be gas, hybrid, or ev.";
  }
  if (body.condition_note && !CONDITIONS.includes(body.condition_note)) {
    return "Condition must be new or used.";
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return "Status must be active, sold, or removed.";
  }
  return null;
}

function toRow(body, sellerUser, existing) {
  const pick = (key, fallback) => {
    if (body[key] === undefined) return existing ? existing[key] : fallback;
    if (body[key] === "") return null;
    return body[key];
  };
  // Number(...) guarded by "is there actually a value" rather than plain
  // truthiness, so a legitimate 0 (e.g. quantity 0 = out of stock) isn't
  // silently replaced by the fallback the way `value ? Number(value) : x`
  // would (0 is falsy).
  const numOrDefault = (key, def) => {
    const v = pick(key, null);
    return v !== null && v !== undefined && v !== "" ? Number(v) : def;
  };
  return {
    title: String(pick("title", "")).trim(),
    category: pick("category", null),
    make_compat: pick("make_compat", null),
    model_compat: pick("model_compat", null),
    year_compat: numOrDefault("year_compat", null),
    fuel_type: pick("fuel_type", null),
    condition_note: pick("condition_note", null),
    price: numOrDefault("price", null),
    quantity: numOrDefault("quantity", 1),
    description: pick("description", null),
    // A listing can give its own contact info; leaving these blank falls
    // back to the seller's account phone/email so a listing is never
    // unreachable.
    contact_phone: String(pick("contact_phone", sellerUser.phone) || "").trim() || sellerUser.phone,
    contact_email: String(pick("contact_email", sellerUser.email) || "").trim() || sellerUser.email,
    status: existing ? pick("status", existing.status) : "active",
  };
}

router.post("/parts", (req, res) => {
  const err = validatePayload(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const data = toRow(req.body || {}, req.sellerUser, null);
  const info = db
    .prepare(
      `INSERT INTO parts
        (title, category, make_compat, model_compat, year_compat, fuel_type, condition_note,
         price, quantity, description, seller_id, contact_phone, contact_email, status)
       VALUES
        (@title, @category, @make_compat, @model_compat, @year_compat, @fuel_type, @condition_note,
         @price, @quantity, @description, @seller_id, @contact_phone, @contact_email, @status)`
    )
    .run({ ...data, seller_id: req.sellerUser.id });
  if (Array.isArray(req.body.images)) replaceImages(info.lastInsertRowid, req.body.images);
  res.status(201).json({ part: partWithImages(info.lastInsertRowid) });
});

function loadOwn(req, res) {
  const existing = db.prepare("SELECT * FROM parts WHERE id = ?").get(req.params.id);
  if (!existing || existing.seller_id !== req.sellerUser.id) {
    res.status(404).json({ error: "Listing not found." });
    return null;
  }
  return existing;
}

router.put("/parts/:id", (req, res) => {
  const existing = loadOwn(req, res);
  if (!existing) return;
  const err = validatePayload({ ...existing, ...req.body });
  if (err) return res.status(400).json({ error: err });
  const data = toRow(req.body || {}, req.sellerUser, existing);
  db.prepare(
    `UPDATE parts SET title=@title, category=@category, make_compat=@make_compat, model_compat=@model_compat,
       year_compat=@year_compat, fuel_type=@fuel_type, condition_note=@condition_note, price=@price,
       quantity=@quantity, description=@description, contact_phone=@contact_phone, contact_email=@contact_email,
       status=@status, updated_at=datetime('now')
     WHERE id=@id AND seller_id=@seller_id`
  ).run({ ...data, id: existing.id, seller_id: req.sellerUser.id });
  if (Array.isArray(req.body.images)) replaceImages(existing.id, req.body.images);
  res.json({ part: partWithImages(existing.id) });
});

router.delete("/parts/:id", (req, res) => {
  const existing = loadOwn(req, res);
  if (!existing) return;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM part_images WHERE part_id = ?").run(existing.id);
    db.prepare("DELETE FROM parts WHERE id = ? AND seller_id = ?").run(existing.id, req.sellerUser.id);
  });
  tx();
  res.json({ ok: true });
});

module.exports = router;
