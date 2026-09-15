// paths.js — where durable data lives.
//
// By default (local dev, or any host without a persistent disk) this is
// just a `data/` folder next to the app, which is fine until the host
// wipes local files on restart/redeploy — see the README's "Persistent
// storage on Render" section.
//
// On a host with a persistent disk attached (e.g. Render's paid plans),
// set the DATA_DIR environment variable to that disk's mount path. Once
// set, the SQLite database, the session store, AND uploaded photos all
// live on the disk instead of the app's ephemeral source tree, so none
// of it disappears on the next deploy.

const path = require("path");
const fs = require("fs");

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");

const uploadsDir = path.join(dataDir, "uploads");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = { dataDir, uploadsDir };
