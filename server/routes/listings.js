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
  });
});

router.get("/vehicles/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Vehicle not found." });
  res.json({ vehicle: row });
});

router.get("/parts", (req, res) => {
  const rows = db.prepare("SELECT * FROM parts ORDER BY created_at DESC").all();
  res.json({ parts: rows });
});

router.get("/parts/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM parts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Part not found." });
  res.json({ part: row });
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
