// auth.js — registration, login, logout, and "who am I" for the
// account system that gates the daily auction links.

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, buyer_type)
  VALUES (@name, @email, @password_hash, @buyer_type)
`);
const findByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const findById = db.prepare("SELECT id, name, email, buyer_type, created_at FROM users WHERE id = ?");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/register", async (req, res) => {
  const { name, email, password, buyer_type } = req.body || {};

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
    });
    req.session.userId = info.lastInsertRowid;
    const user = findById.get(info.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Could not create account. Please try again." });
  }
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
