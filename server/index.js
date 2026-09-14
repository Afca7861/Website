// index.js — the whole AFCA Auto Sales server: static site + JSON API
// for auth, listings, and the gated auction feed.

require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

require("./db"); // ensures schema exists before anything else runs

const authRoutes = require("./routes/auth");
const listingsRoutes = require("./routes/listings");
const auctionsRoutes = require("./routes/auctions");

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
    store: new SQLiteStore({ db: "sessions.db", dir: path.join(__dirname, "..", "data") }),
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
