// index.js — the whole AFCA Auto Sales server: static site + JSON API
// for auth, listings, and the gated auction feed.

require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const db = require("./db"); // ensures schema exists before anything else runs
const { dataDir, uploadsDir } = require("./paths");

const authRoutes = require("./routes/auth");
const listingsRoutes = require("./routes/listings");
const auctionsRoutes = require("./routes/auctions");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Most hosting platforms (Render, Railway, Heroku, etc.) put the app behind
// a reverse proxy that terminates HTTPS. Express needs to know that so
// "secure" cookies (see below) work correctly instead of silently failing.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

if (!process.env.SESSION_SECRET) {
  console.warn(
    "WARNING: SESSION_SECRET is not set in the environment. Using an insecure default — set a real secret before deploying (see README)."
  );
}

app.use(express.json());
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: dataDir }),
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === "production", // requires HTTPS in production
      sameSite: "lax",
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api", listingsRoutes);
app.use("/api", auctionsRoutes);
app.use("/api/admin", adminRoutes);

// One-time (safe to leave set) admin bootstrap: if ADMIN_BOOTSTRAP_EMAIL is
// set and a registered account matches it, grant that account the 'admin'
// role on every startup. There's no other way to create an admin — see
// README.md.
if (process.env.ADMIN_BOOTSTRAP_EMAIL) {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase().trim();
  const info = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(bootstrapEmail);
  if (info.changes > 0) {
    console.log(`Granted admin role to ${bootstrapEmail} (via ADMIN_BOOTSTRAP_EMAIL).`);
  } else {
    console.log(
      `ADMIN_BOOTSTRAP_EMAIL is set to ${bootstrapEmail}, but no account with that email exists yet. ` +
      `Register on the site with this exact email, then restart the server to become admin.`
    );
  }
}

// Photos uploaded through the admin panel live in uploadsDir (see
// paths.js) — normally data/uploads next to the app, but once DATA_DIR
// points at a persistent disk it's a folder on that disk instead. Either
// way it's outside public/, so it needs its own static mount.
app.use("/uploads", express.static(uploadsDir));

app.use(express.static(path.join(__dirname, "..", "public")));

// Any unmatched, non-API GET falls back to index.html-style 404 page.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found." });
  }
  res.status(404).sendFile(path.join(__dirname, "..", "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`AFCA Auto Sales website running at http://localhost:${PORT}`);
});
