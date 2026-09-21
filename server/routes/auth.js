// auth.js — registration, login, logout, and "who am I" for the
// account system that gates the daily auction links.

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, buyer_type, phone, is_seller, paypal_email, postal_code, status)
  VALUES (@name, @email, @password_hash, @buyer_type, @phone, @is_seller, @paypal_email, @postal_code, 'pending')
`);
const findByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const findById = db.prepare(
  "SELECT id, name, email, buyer_type, role, phone, is_seller, paypal_email, postal_code, status, created_at FROM users WHERE id = ?"
);

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/register", async (req, res) => {
  const { name, email, password, buyer_type, become_seller, phone, paypal_email, postal_code } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const normalizedBuyerType = ["local", "trade", "overseas"].includes(buyer_type) ? buyer_type : "local";
  const wantsSeller = become_seller === true || become_seller === "true" || become_seller === "on";
  if (wantsSeller) {
    if (!String(phone || "").trim()) {
      return res.status(400).json({ error: "A contact phone number is required to register as a Parts Seller." });
    }
    if (!isValidEmail(paypal_email)) {
      return res.status(400).json({ error: "A valid PayPal email is required to register as a Parts Seller — that's where you'll be paid out." });
    }
    if (!String(postal_code || "").trim()) {
      return res.status(400).json({ error: "A postal code is required to register as a Parts Seller — it's used to work out local (50km) shipping for your listings." });
    }
  }

  const existing = findByEmail.get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const password_hash = await bcrypt.hash(password, 12);

  try {
    const info = insertUser.run({
      name: String(name).trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      buyer_type: normalizedBuyerType,
      phone: phone ? String(phone).trim() : null,
      is_seller: wantsSeller ? 1 : 0,
      paypal_email: wantsSeller ? String(paypal_email).trim().toLowerCase() : null,
      postal_code: wantsSeller ? String(postal_code).trim() : null,
    });
    // New accounts start 'pending' (see insertUser above) and are NOT
    // logged in here — an admin has to approve the account (Admin panel
    // → Customers → Approve) before its first login succeeds. See the
    // status check in /login below.
    const user = findById.get(info.lastInsertRowid);
    res.status(201).json({ user, pending: true });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Could not create account. Please try again." });
  }
});

// Lets an already-registered member register as a Parts Seller later,
// from /account.html, without creating a second account. Requires a
// contact phone number (used as the default contact on new listings —
// each listing can still override it), a PayPal email (where checkout
// payouts are sent — see server/routes/orders.js), and a postal code
// (the shipping-distance origin for the 50km eligibility check).
router.post("/become-seller", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in first." });
  const { phone, paypal_email, postal_code } = req.body || {};
  if (!String(phone || "").trim()) {
    return res.status(400).json({ error: "A contact phone number is required to register as a Parts Seller." });
  }
  if (!isValidEmail(paypal_email)) {
    return res.status(400).json({ error: "A valid PayPal email is required — that's where you'll be paid out for sales." });
  }
  if (!String(postal_code || "").trim()) {
    return res.status(400).json({ error: "A postal code is required — it's used to work out local (50km) shipping for your listings." });
  }
  db.prepare("UPDATE users SET is_seller = 1, phone = ?, paypal_email = ?, postal_code = ? WHERE id = ?").run(
    String(phone).trim(),
    String(paypal_email).trim().toLowerCase(),
    String(postal_code).trim(),
    req.session.userId
  );
  res.json({ user: findById.get(req.session.userId) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = findByEmail.get(String(email).toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.status === "pending") {
    return res.status(403).json({ error: "Your account is still awaiting admin approval. Please check back soon." });
  }

  req.session.userId = user.id;
  res.json({ user: findById.get(user.id) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = findById.get(req.session.userId);
  res.json({ user: user || null });
});

module.exports = router;
