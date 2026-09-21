// auctions.js — the account-gated daily auction feed.
//
// This is the one part of the site the client explicitly asked to be
// restricted: the direct link to each auction listing must only reach
// visitors who have registered and logged in. Everyone else can see
// that the listing exists (photo, year/make/model, close time) but the
// `auction_url` field is stripped server-side — never sent to the
// browser at all — for logged-out requests, so there's no way to get
// the link by reading the page source or the network tab.

const express = require("express");
const db = require("../db");

const router = express.Router();

function stripAuctionUrl(row) {
  const { auction_url, ...rest } = row;
  return { ...rest, locked: true };
}

router.get("/auctions", (req, res) => {
  const rows = db.prepare("SELECT * FROM auctions ORDER BY created_at DESC").all();
  // Re-check the account's current status rather than trusting the
  // session alone — if an admin removes a customer, or a previously
  // logged-in account somehow ends up back in 'pending', their existing
  // session cookie should stop unlocking auction links on their very
  // next request, not just after they happen to log out.
  let loggedIn = false;
  if (req.session.userId) {
    const account = db.prepare("SELECT status FROM users WHERE id = ?").get(req.session.userId);
    loggedIn = Boolean(account && account.status === "approved");
  }
  const payload = loggedIn ? rows.map((r) => ({ ...r, locked: false })) : rows.map(stripAuctionUrl);
  res.json({ auctions: payload, loggedIn });
});

module.exports = router;
