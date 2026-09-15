# AFCA Auto Sales Ltd. — Website

A real, deployable website for AFCA Auto Sales Ltd. covering all three lines
of business the client described:

1. **Local used vehicle sales** — for students, newcomers, low-income
   families, and budget-conscious buyers.
2. **Car parts marketplace** — for local mechanics, individuals, and other
   dealerships.
3. **Salvage & export vehicle sales** — to overseas buyers, primarily in
   Eastern Europe, Africa, and the Middle East.

The landing page follows the client's brief exactly: a sliding local-inventory
carousel with text-over-image pricing (Section A), and a daily auction feed
(Section B) whose **direct auction links are only sent to logged-in,
registered accounts** — the server never sends the link to a logged-out
browser at all, so it can't be recovered from page source or dev tools.

Built by three roles, as requested:

- **Tarrah — Website Outline Developer:** [`docs/outline.md`](docs/outline.md)
  (sitemap, page-by-page content plan)
- **Website Graphics Designer:** [`docs/design-system.md`](docs/design-system.md)
  (colors, typography, layout rules, logo)
- **Website Software Programmer:** everything under `server/` and `public/`

## Important — read before you deploy

**I could not run `npm install` or start the server inside the sandbox that
built this code** — this environment's network policy blocks
`registry.npmjs.org` outright (a `403 Host not in allowlist` from the
network gateway, confirmed by direct testing, not something a retry fixes).
So while every file has been syntax-checked and carefully reviewed by hand,
**it has not been run end-to-end yet.** Please do that first, locally,
before pointing a domain at it:

```bash
npm install
cp .env.example .env
# edit .env: set a real SESSION_SECRET (see the comment in that file)
npm start
```

Then open `http://localhost:3000`, and click through: register an account,
log out, confirm the auction feed hides the link when logged out and shows
it when logged in, browse cars/parts/export, etc. If anything breaks, the
error will be far easier to fix locally than to debug blind — sorry for the
extra step, and thank you for bearing with the sandbox's limitation.

## What's real vs. placeholder right now

- **Real:** the business name, address, and public email (pulled from your
  Facebook page), the three-service-line structure, the account
  registration/login system, and the auction-gating logic.
- **Placeholder — replace before launch:**
  - Phone number and business hours (marked `[TODO]` in the footer/contact
    page — your Facebook page currently just says "Always open," which
    looks like an unset default rather than real hours)
  - Twitter/X and Instagram links (marked `[TODO]` — send handles and I'll
    wire them in, or edit the `social-icons` block in each page's footer)
  - All vehicle, parts, and auction listings are clearly-labeled `SAMPLE —`
    rows from `server/seed.js`, not real inventory
  - The logo at `public/assets/logo.svg` is a rebuilt vector version of your
    Facebook logo (same colors/layout) — I sampled the real logo's colors
    directly but couldn't reliably transfer the exact image file through
    this session; drop your real logo file in as `public/assets/logo.svg`
    (or point the `<img>` in each page's header at your file) to use the
    exact original
  - The contact form on `/contact.html` shows a success message but doesn't
    actually send anywhere yet — wire it to an email service or CRM

## Admin panel

There's now a real admin UI at **`/admin.html`** (sign in at
**`/admin-login.html`**) for posting and editing listings in all four
sections — local cars, export/salvage cars, parts, and the daily auction
feed — including uploading a photo for each one. It also has a **Site
Banner** tab for changing the homepage banner's photo, headline, and
subtext without touching any code — upload a photo there and it replaces
the default placeholder graphic on the homepage immediately. No coding or
database tool required day-to-day.

**Becoming the first admin** (there's no public sign-up for this, on
purpose):

1. Register a normal customer account on the live site with the email
   address you want to use as admin.
2. Set the `ADMIN_BOOTSTRAP_EMAIL` environment variable (in `.env` locally,
   or in your hosting platform's environment variable settings) to that
   same email address.
3. Restart the server. On every startup, if a registered account matches
   `ADMIN_BOOTSTRAP_EMAIL`, it's granted the `admin` role. It's safe to
   leave this variable set permanently — it only ever affects that one
   account.
4. Log in at `/admin-login.html`. Once you're in, you'll also see a
   discreet "Admin" button in the header on every page.

You can grant additional admins the same way (set `ADMIN_BOOTSTRAP_EMAIL`
to each new address in turn and restart), or, faster, once you have one
admin account, open `data/afca.db` directly and run
`UPDATE users SET role = 'admin' WHERE email = '...';`.

**Important limitation on Render's (and most) free tiers:** free web
service plans don't include persistent disk storage, so both the SQLite
database *and* any photos uploaded through the admin panel live on disk
that gets wiped on every restart or redeploy. That's fine for testing, but
before relying on this for real inventory, upgrade to a plan with a
persistent disk and follow "Persistent storage on Render" below (or move
photo storage to something like Cloudinary/S3 instead — ask me and I can
wire that in).

## Persistent storage on Render

Once you're on a paid Render plan (persistent disks aren't available on
the free tier), attach a disk so the database and uploaded photos stop
resetting on every deploy:

1. In the Render dashboard, open your web service → **Disks** tab → **Add
   Disk**.
2. Give it a name (e.g. `afca-data`), a **mount path** of `/var/data`, and
   a size — 1 GB is plenty to start ($0.25/GB/month).
3. Under **Environment**, add a variable: **Key** `DATA_DIR`, **Value**
   `/var/data` (matching the mount path from step 2).
4. Save — Render will redeploy. From then on, the SQLite database, the
   session store, and every photo uploaded through `/admin.html` are
   written to that disk instead of the app's source tree, so they survive
   restarts and future deploys.

Because switching this on starts from an empty disk, you'll need to
register your admin account again afterward (see "Admin panel" above) —
but this time it'll actually stick.

## Getting real inventory into the site

Listings live in a SQLite database (`data/afca.db`, created automatically).
The admin panel above is the easiest way to manage them day-to-day. A few
other options, roughly in order of effort:

1. **Quickest (no admin panel):** open `data/afca.db` with a SQLite browser
   (e.g. "DB Browser for SQLite") and edit the `vehicles`, `parts`, and
   `auctions` tables directly.
2. **Scriptable:** write a small Node script using the same `better-sqlite3`
   `db` object (see `server/seed.js` for the pattern) that reads from
   whatever spreadsheet or export AFCA already uses.
3. **Automated:** if the "Daily Cars" Google Drive workflow already used for
   Facebook posts has structured data (filenames, a spreadsheet, etc.), that
   could feed the `vehicles`/`auctions` tables on a schedule — ask me and I
   can help build that connector once you tell me the folder's structure.

## Project structure

```
server/
  index.js        Express app entry point (sessions, static files, routes)
  db.js           SQLite schema (users, vehicles, parts, auctions)
  seed.js         Inserts sample listings on first run (run: npm run seed)
  routes/
    auth.js       /api/auth/register, /login, /logout, /me
    listings.js   /api/vehicles, /api/parts (public, read-only)
    auctions.js   /api/auctions (gates auction_url server-side by login state)
    admin.js      /api/admin/* — listing CRUD + photo upload, admin-only
public/
  index.html, cars.html, parts.html, export.html, auctions.html,
  vehicle.html, part.html, register.html, login.html, account.html,
  about.html, contact.html, 404.html
  admin.html, admin-login.html   Admin panel (see "Admin panel" below)
  css/style.css   Design system implemented as CSS custom properties
  js/             main.js (nav + auth header), carousel.js, listings.js,
                  auctions.js, admin.js
  assets/         logo.svg + placeholder images
  uploads/        Photos uploaded through the admin panel (gitignored)
docs/
  outline.md          Tarrah's sitemap & content plan
  design-system.md    Color palette, typography, layout rules
```

## How the account gating actually works

This was the client's specific requirement, so it's worth being explicit:
`server/routes/auctions.js` reads the visitor's session on every request to
`/api/auctions`. If there's no logged-in user, it **deletes the
`auction_url` field from each row before sending the JSON response** — the
link is never transmitted to a logged-out browser, not just hidden by CSS or
JavaScript. A logged-in session (checked via `express-session`, backed by a
SQLite-stored session table so logins survive server restarts) gets the
full row including the link.

## Deployment options

This is a standard Node.js + Express app with a file-based SQLite database,
so it runs almost anywhere that supports Node:

- **Render / Railway / Fly.io** — simplest for a small business site;
  connect the repo, set the `SESSION_SECRET` and `NODE_ENV=production`
  environment variables, and deploy. Make sure whatever plan you pick has a
  **persistent disk** for the `data/` folder — the SQLite file needs to
  survive restarts and deploys, or accounts/listings will reset.
- **A VPS (DigitalOcean, Linode, etc.)** — install Node 18+, `npm install`,
  run with a process manager like PM2, and put nginx in front for HTTPS and
  to serve the `afcaauto.ca` domain.
- **Shared hosting with Node support** — works too, as long as it allows a
  persistent SQLite file and long-running Node processes (not all
  "PHP-style" shared hosts do).

Point your `afcaauto.ca` domain's DNS at whichever host you choose once it's
confirmed working.
