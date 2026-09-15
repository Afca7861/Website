// db.js — SQLite setup for the AFCA Auto Sales website.
// Uses a single file-based database (data/afca.db) so the whole site
// runs with zero external services. Good enough for a small dealership's
// traffic; if AFCA outgrows it, swap this module for a hosted Postgres
// connection without touching the routes (they only call the functions
// exported below).

const path = require("path");
const Database = require("better-sqlite3");
const { dataDir } = require("./paths");

const db = new Database(path.join(dataDir, "afca.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT 'local', -- 'local' | 'trade' | 'overseas'
  role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin' — see ADMIN_BOOTSTRAP_EMAIL in README
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- 'local' | 'export'
  title TEXT NOT NULL,
  price INTEGER,
  year INTEGER,
  make TEXT,
  model TEXT,
  mileage INTEGER,
  condition_note TEXT,
  description TEXT,
  image_url TEXT,
  tags TEXT, -- comma-separated
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  make_compat TEXT,
  model_compat TEXT,
  condition_note TEXT, -- 'OEM' | 'Aftermarket' | 'Used' etc.
  price INTEGER,
  quantity INTEGER DEFAULT 1,
  description TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  year INTEGER,
  make TEXT,
  model TEXT,
  image_url TEXT,
  auction_source TEXT, -- e.g. 'IAAI', 'Copart'
  auction_url TEXT NOT NULL, -- only ever sent to logged-in users
  close_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Site-wide, admin-editable settings (currently just the homepage banner).
-- Small and generic on purpose: a key/value row per setting rather than a
-- dedicated table, since there's only a handful of these. Every key here
-- is readable by anyone via GET /api/settings, so don't add anything
-- sensitive to this table.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;
