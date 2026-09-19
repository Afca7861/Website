// listings.js — public read-only endpoints for local used cars and
// car parts. Neither of these needs to be gated: the client's gating
// requirement is specifically for auction direct links (see auctions.js).

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/vehicles", (req, res) => {
  // category: "export" filters to export/salvage, "all" skips the category
  // filter entirely (used by the inventory search), and anything else
  // (including no category at all) keeps the original default of "local"
  // so existing callers like cars.html/export.html are unaffected.
  const clauses = [];
  const params = [];

  if (req.query.category === "export") {
    clauses.push("category = ?");
    params.push("export");
  } else if (req.query.category !== "all") {
    clauses.push("category = ?");
    params.push("local");
  }

  if (req.query.condition) {
    clauses.push("condition_note = ?");
    params.push(req.query.condition);
  }
  if (req.query.year) {
    clauses.push("year = ?");
    params.push(Number(req.query.year));
  }
  if (req.query.make) {
    clauses.push("make = ?");
    params.push(req.query.make);
  }
  if (req.query.model) {
    clauses.push("model = ?");
    params.push(req.query.model);
  }
  if (req.query.body_type) {
    clauses.push("body_type = ?");
    params.push(req.query.body_type);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM vehicles ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ vehicles: rows });
});

// Distinct values currently in the vehicles table, for building the
// homepage search dropdowns (Condition / Year / Make / Model) so they
// always reflect real inventory rather than a hardcoded list. Registered
// before /vehicles/:id so "facets" isn't swallowed as an :id value.
router.get("/vehicles/facets", (req, res) => {
  const distinct = (column, extraWhere) => {
    const where = [`${column} IS NOT NULL`, `TRIM(${column}) <> ''`];
    if (extraWhere) where.push(extraWhere);
    return db
      .prepare(`SELECT DISTINCT ${column} AS value FROM vehicles WHERE ${where.join(" AND ")} ORDER BY ${column}`)
      .all()
      .map((r) => r.value);
  };
  res.json({
    conditions: distinct("condition_note"),
    years: db
      .prepare("SELECT DISTINCT year AS value FROM vehicles WHERE year IS NOT NULL ORDER BY year DESC")
      .all()
      .map((r) => r.value),
    makes: distinct("make"),
    models: distinct("model"),
    body_types: distinct("body_type"),
  });
});

router.get("/vehicles/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Vehicle not found." });
  res.json({ vehicle: row });
});

// Parts catalog — combines admin-posted parts (seller_id NULL) and
// community Parts Seller listings (seller_id set) in one search/browse
// list. Visitors can filter by make/model/year/fuel type/condition and
// do a free-text search across the title and description.
router.get("/parts", (req, res) => {
  const clauses = ["status = 'active'"];
  const params = [];

  if (req.query.q) {
    clauses.push("(title LIKE ? OR description LIKE ? OR make_compat LIKE ? OR model_compat LIKE ?)");
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }
  if (req.query.make) {
    clauses.push("make_compat = ?");
    params.push(req.query.make);
  }
  if (req.query.model) {
    clauses.push("model_compat = ?");
    params.push(req.query.model);
  }
  if (req.query.year) {
    clauses.push("year_compat = ?");
    params.push(Number(req.query.year));
  }
  if (req.query.fuel_type) {
    clauses.push("fuel_type = ?");
    params.push(req.query.fuel_type);
  }
  if (req.query.condition) {
    clauses.push("condition_note = ?");
    params.push(req.query.condition);
  }
  if (req.query.min_price) {
    clauses.push("price >= ?");
    params.push(Number(req.query.min_price));
  }
  if (req.query.max_price) {
    clauses.push("price <= ?");
    params.push(Number(req.query.max_price));
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM parts ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ parts: rows });
});

// Distinct values currently in the (active) parts table, for building the
// parts search dropdowns — mirrors /vehicles/facets. Registered before
// /parts/:id so "facets" isn't swallowed as an :id value.
router.get("/parts/facets", (req, res) => {
  const distinct = (column) =>
    db
      .prepare(
        `SELECT DISTINCT ${column} AS value FROM parts WHERE status = 'active' AND ${column} IS NOT NULL AND TRIM(${column}) <> '' ORDER BY ${column}`
      )
      .all()
      .map((r) => r.value);
  res.json({
    makes: distinct("make_compat"),
    models: distinct("model_compat"),
    years: db
      .prepare(
        "SELECT DISTINCT year_compat AS value FROM parts WHERE status = 'active' AND year_compat IS NOT NULL ORDER BY year_compat DESC"
      )
      .all()
      .map((r) => r.value),
    fuel_types: distinct("fuel_type"),
  });
});

router.get("/parts/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM parts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Part not found." });
  const images = db
    .prepare("SELECT image_url FROM part_images WHERE part_id = ? ORDER BY sort_order ASC, id ASC")
    .all(req.params.id)
    .map((i) => i.image_url);
  let seller = null;
  if (row.seller_id) {
    seller = db.prepare("SELECT name FROM users WHERE id = ?").get(row.seller_id) || null;
  }
  res.json({ part: { ...row, images: images.length ? images : row.image_url ? [row.image_url] : [], seller } });
});

// Public, read-only site settings (currently just the homepage banner —
// photo/headline/subtext, editable by an admin at /admin.html). Nothing
// in this table is sensitive, so it's fine to expose the whole thing.
router.get("/settings", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  res.json({ settings: out });
});

module.exports = router;
