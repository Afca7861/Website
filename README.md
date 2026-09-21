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

## Sept 2026 — visual redesign (Soni Motors-inspired)

The site's look was refreshed to read as a more polished, professional
dealer storefront, using [sonimotors.ca](https://www.sonimotors.ca/) as a
design reference. This was a **visual/feature refresh, not a rebuild** —
every existing page, route, and piece of data still works exactly as
before; nothing was removed.

What changed:

- **New color palette & type.** A deep navy (`--afca-navy`) joins the
  existing blue/red/green brand colors for the header topbar, footer, and
  hero overlay — Soni's "dark navigation, bright content" feel. Headings
  now use Poppins and body text Inter (via Google Fonts), replacing the
  old system-font stack. See `public/css/style.css`.
- **Utility topbar.** A slim dark bar above the header on every page
  (location, hours, Facebook, email) — same pattern as Soni's top bar.
  Hours are still a `[TODO]` placeholder until AFCA confirms them (same
  convention as the phone number already flagged elsewhere).
- **Homepage hero slider.** Replaces the old single static banner with a
  3-slide rotating promo (`public/js/hero-slider.js`): Slide 1 is still
  driven by the admin-editable Site Banner settings (Admin panel → Site
  Banner tab — nothing an admin already set was lost), slides 2–3 promote
  the Parts Marketplace and Export/Ship Cars lines. Auto-rotates, pauses
  on hover, has prev/next + dot controls.
- **Quick-search by body type.** A row of chips under the homepage hero
  (SUV, Sedan, Hatchback, Wagon, Mini-Van, Pickup) that jump straight into
  a filtered `/cars.html?body_type=...` view — mirrors Soni's quick-search
  row. `cars.html` also got its own full filter bar (body type, condition,
  year, make, model). This required a small schema addition:
  `vehicles.body_type` (nullable `TEXT`, migrated automatically on
  startup same as every other column added since launch — see
  `ensureColumn()` in `server/db.js`). The admin panel's Local Cars and
  Export/Salvage forms now have a Body Type dropdown.
- **Payment calculator.** New `/payment-calculator.html` — a simple,
  fully client-side loan estimator (price, down payment, trade-in, APR,
  term → estimated monthly payment), linked from the nav and the
  homepage. Nothing here is saved or sent to the server; it's a planning
  tool only, with a disclaimer to contact AFCA for a real quote.

Nothing about the account/auth model, the Parts Seller portal, the admin
panel's other sections, or the auction-gating behavior changed — this was
purely the presentation layer plus the three additions above.

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

## Community Parts Seller portal

Beyond the admin-managed parts catalog, any registered member can now
register as a **Parts Seller** and list their own car parts directly —
no admin involvement needed to post a listing.

**Becoming a seller:**
- At sign-up, check "I want to register as a Parts Seller too" on
  `/register.html` and add a contact phone number, or
- Any time later, from `/account.html` → "Become a Parts Seller" (also just
  a phone number).

**The seller dashboard — `/sell-parts.html`:** once registered as a seller,
this page lets a member:
- Add a new part listing: part name, vehicle make/model/year, fuel/power
  type (Gas / Hybrid / EV), price, condition (New / Used), quantity, a
  description, up to 8 photos, and a contact phone + email for that
  specific listing (defaults to the account's phone/email, editable per
  listing).
- See all of their own listings in a table, edit any of them, mark one
  "sold" (hides it from search without deleting it — flip it back to
  active any time), or delete it outright.
- A seller can only ever see and edit their own listings — every
  `/api/seller/*` route re-checks `seller_id` against the logged-in
  session server-side (see `server/routes/seller.js`).

**Visitor search — `/parts.html`:** the Car Parts Marketplace page now has
a full search/filter bar (keyword, make, model, year, fuel/power type,
condition) built from whatever's actually in the `parts` table
(`GET /api/parts/facets`), so it covers both admin-posted parts and
community seller listings in one combined catalog. The part detail page
(`/part.html`) shows a full photo gallery and a "Contact the seller" block
with tap-to-call / tap-to-email links built from that listing's contact
info.

**Moderation:** seller-submitted listings are not held for approval — they
go live immediately, the same way a community marketplace normally works.
They *do* still show up in `/admin.html`'s Parts tab alongside admin-posted
ones, so an admin can edit or delete any listing (including a seller's) if
something needs to come down. If you'd rather listings wait for admin
approval before going live, that's a small addition to `server/routes/
seller.js` (default new listings to a `pending` status and filter those out
of the public `/api/parts` query) — ask and I can wire it in.

**Data model note:** parts can now have multiple photos (`part_images`
table) in addition to the original single `image_url` column, which is
kept in sync as a "primary photo" so older code that only knows about
`image_url` keeps working. `server/db.js` adds the new columns/table to an
existing `data/afca.db` automatically on next startup — no manual
migration step, existing listings are untouched.

## Car Parts checkout & payments (PayPal)

Visitors can now buy a listed part directly on the site — no account
required to buy — with payment split automatically: **95% of the part
price goes straight to the seller's own PayPal, 5% plus a flat $20
local-shipping surcharge (when shipping is chosen) stays with AFCA.**

**How it works, end to end:**
1. A member becomes a Parts Seller (`/register.html` or `/account.html` →
   "Become a Parts Seller") and now also provides a **PayPal email**
   (where their share gets paid) and a **postal code** (used to work out
   which buyers are within 50km for shipping). Both are required — without
   them, checkout won't have anywhere to send the payout.
2. A visitor opens a part's page (`/part.html`) and uses the new "Buy this
   part online" panel: pickup (free) or ship to me (+$20, only offered
   within 50km of the seller), their name/email/phone, and — for
   shipping — an address and postal code.
3. Payment happens entirely inside PayPal's own Checkout flow (a "PayPal"
   button plus a "Debit or Credit Card" guest-checkout option PayPal shows
   automatically) — nothing card-related ever touches AFCA's own server.
4. The instant payment is captured, AFCA's server automatically fires a
   PayPal Payouts call sending the seller their 95% — the buyer never
   waits on that, and never sees it.
5. Admin's **Orders** tab (`/admin.html`) lists every sale, the AFCA cut,
   the seller payout, and its status. If a payout ever fails (e.g. a
   typo'd PayPal email), the order shows **Payout pending** and a **Retry
   payout** button — the buyer's payment is never affected by a payout
   hiccup.

**Setup required before this can take real payments** — three environment
variables (`.env` locally, or your hosting platform's environment variable
settings, same as `SESSION_SECRET`):

- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` — from a PayPal Business
  account's app at [developer.paypal.com](https://developer.paypal.com)
  (Apps & Credentials). `PAYPAL_CLIENT_ID` is also sent to the browser (the
  checkout page's PayPal button script needs it) — that's normal and safe,
  it's meant to be public, the same way a "publishable key" works elsewhere.
  `PAYPAL_CLIENT_SECRET` never leaves the server.
- `PAYPAL_MODE` — `sandbox` (the default if unset) or `live`. **Leave this
  as `sandbox` until you're ready to accept real money** — sandbox uses
  PayPal's fake-money test environment against the exact same API, so
  nothing about the checkout flow changes when you flip it to `live`; it's
  purely a safety switch. Test with a PayPal sandbox buyer account
  (developer.paypal.com → Sandbox → Accounts) before going live.
- **You also need Payouts enabled on that PayPal Business account** — this
  is what actually sends the seller their 95%. It's a checkbox/request in
  the same developer dashboard; PayPal may ask a few questions before
  turning it on for a new business account. Until it's on, checkout will
  still work but every sale will land in the admin Orders tab as "Payout
  pending" (the buyer's payment still succeeds either way).

Until all three variables are set, the checkout button tells visitors
"Online payments aren't set up yet" rather than failing partway through.

**Known simplifications, worth knowing about:**
- The 50km shipping check uses free, no-key-required postal-code lookups
  (`api.zippopotam.us`) at the postal-code-prefix (FSA) level — a close
  approximation, not an exact road-distance calculation, and only as
  reliable as that free service's uptime. Fine for a "does this look
  local?" gate; swap in Google's Distance Matrix API later (see
  `server/lib/geo.js`) if you want exact numbers or your own key.
- A buyer purchases exactly 1 unit per checkout (no quantity picker yet) —
  listing quantity still decreases by 1 per sale, and the listing flips to
  "sold" once it hits 0.
- "Bank account" payouts happen through the seller's own PayPal balance —
  PayPal Payouts sends money to a PayPal email, not to an arbitrary bank
  account directly. A seller withdraws to their bank from inside their own
  PayPal account, same as with any PayPal balance. True direct-to-bank
  payouts (bypassing PayPal entirely) would need a second processor
  (Stripe Connect) running alongside this — ask if you want that added.
- There's no email receipt sent yet — the buyer's confirmation is
  on-screen only after payment. Ask if you'd like order confirmation
  emails added.

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

## Taking the site offline temporarily

Render's own **Maintenance Mode** (Dashboard → your service) blocks the
site for everyone, including you — there's no bypass, so it's really only
for "nobody needs to touch this right now." For anything where you still
want to test while the public sees a "temporarily offline" page, use the
app's own maintenance mode instead:

1. In your hosting platform's environment variable settings (e.g. Render's
   **Environment** tab), add:
   - `MAINTENANCE_MODE` = `true`
   - `MAINTENANCE_BYPASS_TOKEN` = any long random string you make up (e.g.
     run `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
     and use the output)
2. Save — the service restarts. From then on, every visitor sees a simple
   "temporarily offline" page instead of the site.
3. To keep testing yourself, open:
   `https://www.afcaauto.ca/?preview=YOUR_TOKEN_HERE`
   (swap in the token you set above). That link remembers you for 30 days
   via a cookie, so after the first visit you can browse the site
   completely normally — no need to keep the `?preview=` part on every
   page.
4. When you're ready to go live again, just delete (or blank out) the
   `MAINTENANCE_MODE` variable and save — the site is back for everyone
   immediately, no code changes needed.

If you ever set `MAINTENANCE_MODE=true` but forget to set
`MAINTENANCE_BYPASS_TOKEN`, the site intentionally stays fully live rather
than locking everyone out by accident — check the Render logs for a
warning if maintenance mode doesn't seem to be taking effect.

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
  db.js           SQLite schema (users, vehicles, parts, part_images, auctions)
  seed.js         Inserts sample listings on first run (run: npm run seed)
  routes/
    auth.js       /api/auth/register, /login, /logout, /me, /become-seller
    listings.js   /api/vehicles, /api/parts + /api/parts/facets (public, read-only, search/filter)
    auctions.js   /api/auctions (gates auction_url server-side by login state)
    admin.js      /api/admin/* — listing CRUD + photo upload, admin-only
    seller.js     /api/seller/* — a seller's OWN part listings + photo upload (see "Community Parts Seller portal")
public/
  index.html, cars.html, parts.html, export.html, auctions.html,
  vehicle.html, part.html, register.html, login.html, account.html,
  sell-parts.html   Community Parts Seller dashboard (see below)
  payment-calculator.html   Client-side loan/payment estimator (see redesign notes above)
  about.html, contact.html, 404.html
  admin.html, admin-login.html   Admin panel (see "Admin panel" below)
  css/style.css   Design system implemented as CSS custom properties
  js/             main.js (nav + auth header), hero-slider.js (homepage promo slider),
                  carousel.js, listings.js, cars-search.js (Used Cars filter bar),
                  search.js (homepage vehicle search), parts-search.js (parts search),
                  sell-parts.js (seller dashboard), payment-calculator.js,
                  auctions.js, admin.js
  assets/         logo.svg + placeholder images
  uploads/        Photos uploaded through the admin panel or seller portal (gitignored)
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
