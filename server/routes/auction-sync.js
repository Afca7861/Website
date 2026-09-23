// auction-sync.js — a narrow, token-authenticated endpoint that lets an
// unattended automation (a scheduled research run, not a person sitting at
// admin.html) replace the entire auction feed in one shot.
//
// This is deliberately NOT part of admin.js / the requireAdmin session
// gate. The automation that calls this has no login and no session
// cookie — it authenticates with a single long-lived shared secret
// (AUCTION_FEED_SYNC_TOKEN) instead, checked via the X-Sync-Token header.
// That secret is scoped to exactly one thing: replacing rows in the
// `auctions` table. It cannot edit any other listing, approve/remove
// customers, touch orders, or do anything else the real admin login can
// do — so if the token ever leaks, the blast radius is "someone can post
// junk auction listings," not "someone has the keys to the admin panel."
//
// It reuses the exact same public contract as GET /api/auctions
// (server/routes/auctions.js): auction_url is only ever sent to
// logged-in, approved customers. This endpoint only ever writes rows —
// it never reads or returns auction_url in its response.

const crypto = require("crypto");
const express = require("express");
const db = require("../db");

const router = express.Router();

const MAX_AUCTIONS_PER_SYNC = 20;

function timingSafeTokenEquals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so this branch takes
    // roughly the same time as a real compare, rather than short-circuiting.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireSyncToken(req, res, next) {
  const configured = (process.env.AUCTION_FEED_SYNC_TOKEN || "").trim();
  if (!configured) {
    return res.status(503).json({
      error: "Auction feed sync is not configured (AUCTION_FEED_SYNC_TOKEN is not set on the server).",
    });
  }
  const supplied = (req.get("X-Sync-Token") || "").trim();
  if (!supplied || !timingSafeTokenEquals(supplied, configured)) {
    return res.status(401).json({ error: "Invalid or missing sync token." });
  }
  next();
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function cleanYear(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 1900 && n < 2100 ? n : null;
}

// Validates and normalizes one incoming auction entry. Returns
// { ok: true, row } or { ok: false, error }.
function normalizeAuction(item, index) {
  if (!item || typeof item !== "object") {
    return { ok: false, error: `Item ${index}: not an object.` };
  }
  const title = cleanString(item.title);
  if (!title) return { ok: false, error: `Item ${index}: "title" is required.` };
  const auction_url = cleanString(item.auction_url);
  if (!auction_url || !isHttpUrl(auction_url)) {
    return { ok: false, error: `Item ${index} ("${title}"): "auction_url" must be a valid http(s) URL.` };
  }
  return {
    ok: true,
    row: {
      title,
      year: cleanYear(item.year),
      make: cleanString(item.make),
      model: cleanString(item.model),
      image_url: cleanString(item.image_url),
      auction_source: cleanString(item.auction_source),
      auction_url,
      close_time: cleanString(item.close_time),
    },
  };
}

// POST /api/auctions/sync
// Body: { auctions: [ { title, year, make, model, image_url,
//                        auction_source, auction_url, close_time }, ... ] }
//
// Replaces the ENTIRE auctions table with exactly the items supplied —
// this is a refresh of the whole feed, not an append. A run that finds
// fewer than expected still just posts what it found; it's the caller's
// job (the scheduled research run) to decide how many picks to send.
router.post("/auctions/sync", requireSyncToken, (req, res) => {
  const items = Array.isArray(req.body?.auctions) ? req.body.auctions : null;
  if (!items) {
    return res.status(400).json({ error: '"auctions" must be an array.' });
  }
  if (items.length === 0) {
    return res.status(400).json({ error: "\"auctions\" is empty — refusing to wipe the feed with zero replacements. Omit the call instead if there's nothing to post." });
  }
  if (items.length > MAX_AUCTIONS_PER_SYNC) {
    return res.status(400).json({ error: `"auctions" has ${items.length} items — the cap is ${MAX_AUCTIONS_PER_SYNC}.` });
  }

  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const result = normalizeAuction(items[i], i);
    if (!result.ok) return res.status(400).json({ error: result.error });
    rows.push(result.row);
  }

  const insert = db.prepare(`
    INSERT INTO auctions (title, year, make, model, image_url, auction_source, auction_url, close_time)
    VALUES (@title, @year, @make, @model, @image_url, @auction_source, @auction_url, @close_time)
  `);
  const replaceAll = db.transaction((newRows) => {
    db.prepare("DELETE FROM auctions").run();
    for (const row of newRows) insert.run(row);
  });
  replaceAll(rows);

  const count = db.prepare("SELECT COUNT(*) AS c FROM auctions").get().c;
  res.json({ ok: true, count });
});

module.exports = router;
