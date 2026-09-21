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
// Off by default in SQLite — turn it on so `part_images.part_id ...
// ON DELETE CASCADE` actually cleans up a part's photos when the part
// row is deleted. (Routes that delete a part also delete its images
// explicitly, belt-and-suspenders, in case this pragma isn't honored by
// some future SQLite build.)
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT 'local', -- 'local' | 'trade' | 'overseas'
  role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin' — see ADMIN_BOOTSTRAP_EMAIL in README
  phone TEXT, -- contact number, used as the default for new parts listings
  is_seller INTEGER NOT NULL DEFAULT 0, -- 1 once this member has registered as a Parts Seller (see /sell-parts.html)
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
  body_type TEXT, -- 'SUV' | 'Sedan' | 'Hatchback' | 'Wagon' | 'Minivan' | 'Truck' — optional, powers the homepage quick-search
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multiple photos per vehicle (a single listing can have several
-- pictures). vehicles.image_url above stays as a "primary photo"
-- convenience column — kept in sync with the first row here (mirrors
-- the part_images pattern below) — so the homepage/inventory grids,
-- which only ever show one photo per vehicle, keep working unchanged.
CREATE TABLE IF NOT EXISTS vehicle_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  make_compat TEXT,
  model_compat TEXT,
  year_compat INTEGER,
  fuel_type TEXT, -- 'gas' | 'hybrid' | 'ev' — the compatible vehicle's power type
  condition_note TEXT, -- 'OEM' | 'Aftermarket' | 'Used' etc. (admin listings) or 'new' | 'used' (seller listings)
  price INTEGER,
  quantity INTEGER DEFAULT 1,
  description TEXT,
  image_url TEXT, -- primary/legacy single photo (still used by admin-posted parts)
  seller_id INTEGER REFERENCES users(id), -- NULL for admin-posted parts; set for community seller listings
  contact_phone TEXT, -- seller's contact number for this listing
  contact_email TEXT, -- seller's contact email for this listing
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'sold' | 'removed' — sellers manage their own listing status
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multiple photos per part (a single listing can have several pictures).
-- part.image_url above stays as a "primary photo" convenience column —
-- kept in sync with the first row here — so older code/admin listings
-- that only ever set image_url keep working without every call site
-- needing to know about this table.
CREATE TABLE IF NOT EXISTS part_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_part_images_part_id ON part_images(part_id);

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

-- One row per part purchase (see server/routes/orders.js). Dollar amounts
-- are stored in whole-dollar-with-cents REALs (e.g. 119.99), matching the
-- rest of the app's convention of not scaling to integer cents — PayPal
-- amounts are formatted as decimal strings anyway, so there's no reason to
-- introduce a second unit system just for this table.
--
-- Money flow per order: the buyer pays total_amount (part price + the
-- $20 shipping surcharge, when shipping was chosen) into AFCA's own PayPal
-- account. platform_fee (5% of the part price) plus the full shipping
-- fee both simply stay there. seller_payout (95% of the part price) is
-- then sent out via PayPal Payouts to the seller's own paypal_email —
-- skipped entirely (seller_payout stays 0) for admin-posted parts, which
-- have no seller_id and where AFCA is effectively the seller already.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL REFERENCES parts(id),
  seller_id INTEGER REFERENCES users(id), -- copied from parts.seller_id at order time; NULL for admin-posted parts
  part_title TEXT NOT NULL, -- snapshot, so the order stays readable even if the listing is later edited/removed
  part_price REAL NOT NULL,
  fulfillment_method TEXT NOT NULL, -- 'pickup' | 'shipping'
  shipping_fee REAL NOT NULL DEFAULT 0, -- flat $20 when fulfillment_method = 'shipping', entirely AFCA's per the client's instruction
  platform_fee REAL NOT NULL DEFAULT 0, -- 5% of part_price, AFCA's cut
  seller_payout REAL NOT NULL DEFAULT 0, -- 95% of part_price, sent to the seller's PayPal; 0 for admin-posted parts
  total_amount REAL NOT NULL, -- part_price + shipping_fee — what the buyer is actually charged
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  shipping_address TEXT, -- NULL for pickup orders
  shipping_postal_code TEXT, -- NULL for pickup orders
  distance_km REAL, -- distance used for the 50km shipping-eligibility check; NULL for pickup orders
  paypal_order_id TEXT, -- PayPal Checkout Orders v2 order id (Create Order)
  paypal_capture_id TEXT, -- set once the buyer's payment is captured
  payout_batch_id TEXT, -- PayPal Payouts batch id, set once a seller payout is sent
  -- 'pending' (PayPal order created, buyer hasn't paid yet) | 'paid' (payment
  -- captured; seller payout sent successfully, or none was needed) |
  -- 'payout_failed' (payment captured — the sale is real and final — but the
  -- automatic payout to the seller's PayPal failed and needs admin attention,
  -- see POST /api/admin/orders/:id/retry-payout)
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_part_id ON orders(part_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
`);

// ---- Migration safety net --------------------------------------------
// CREATE TABLE IF NOT EXISTS (above) only creates tables that don't exist
// yet — it does nothing for a table that already exists from before this
// column was added (e.g. an `afca.db` from an earlier deploy). This adds
// any missing column by hand so upgrading never requires deleting real
// data. Safe to run every startup: it's a no-op once columns exist.
function ensureColumn(table, column, ddl) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existing.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("users", "phone", "phone TEXT");
ensureColumn("users", "is_seller", "is_seller INTEGER NOT NULL DEFAULT 0");
// Admin approval gate for new registrations — 'pending' | 'approved'.
// DEFAULT 'approved' here is deliberate: it only governs the value
// ALTER TABLE backfills onto rows that already existed before this
// column did, so every account registered before this feature shipped
// stays able to log in unchanged. New registrations (see auth.js
// /register) explicitly insert 'pending' instead of relying on this
// default, so only accounts created from here on require admin sign-off.
ensureColumn("users", "status", "status TEXT NOT NULL DEFAULT 'approved'");

// Body type (SUV / Sedan / Hatchback / Wagon / Minivan / Truck) — powers
// the homepage quick-search chips and the Used Cars filter. Optional: old
// rows and any listing an admin hasn't tagged yet just won't match a
// body-type filter, same as any other optional field on this table.
ensureColumn("vehicles", "body_type", "body_type TEXT");

ensureColumn("parts", "year_compat", "year_compat INTEGER");
ensureColumn("parts", "fuel_type", "fuel_type TEXT");
ensureColumn("parts", "seller_id", "seller_id INTEGER REFERENCES users(id)");
ensureColumn("parts", "contact_phone", "contact_phone TEXT");
ensureColumn("parts", "contact_email", "contact_email TEXT");
ensureColumn("parts", "status", "status TEXT NOT NULL DEFAULT 'active'");
// SQLite disallows a function-call default (like `datetime('now')`) in
// ALTER TABLE ADD COLUMN — only a literal constant or the special
// CURRENT_TIME/CURRENT_DATE/CURRENT_TIMESTAMP keywords are allowed there,
// even though CREATE TABLE (above) allows either. CURRENT_TIMESTAMP
// produces the same 'YYYY-MM-DD HH:MM:SS' UTC format as datetime('now'),
// so this is a safe like-for-like swap, not a behavior change.
ensureColumn("parts", "updated_at", "updated_at TEXT");

// Parts Seller payout details (see server/routes/orders.js and the
// "Become a Parts Seller" forms). A seller must have paypal_email on file
// before checkout will attempt to pay them out for a sale; postal_code is
// the origin used for the 50km shipping-eligibility distance check.
ensureColumn("users", "paypal_email", "paypal_email TEXT");
ensureColumn("users", "postal_code", "postal_code TEXT");

module.exports = db;
