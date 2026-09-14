// listings.js — public read-only endpoints for local used cars and
// car parts. Neither of these needs to be gated: the client's gating
// requirement is specifically for auction direct links (see auctions.js).

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/vehicles", (req, res) => {
  const category = req.query.category === "export" ? "export" : "local";
  const rows = db
    .prepare("SELECT * FROM vehicles WHERE category = ? ORDER BY created_at DESC")
    .all(category);
  res.json({ vehicles: rows });
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

module.exports = router;
