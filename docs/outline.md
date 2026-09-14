# AFCA Auto Sales Ltd — Website Outline
**Prepared by: Tarrah, Website Outline Developer**

## 1. Business facts this outline is built on

- **Legal/trade name:** AFCA Auto Sales Ltd.
- **Location:** 13211 King George Blvd, Surrey, BC, Canada, V3T 2T3 (source: Facebook page)
- **Public contact email:** sales@afcaauto.ca (source: Facebook page)
- **Phone / hours / Twitter / Instagram:** not yet provided — placeholders are marked `[TODO]` throughout the site and must be filled in before launch.
- **Facebook:** https://www.facebook.com/AFCAAutoSalesLtd/
- **Existing brand description (from Facebook):** "We offer reliable, inspected pre-owned vehicles to fit every budget and lifestyle. Whether you're looking for your first car, a family SUV, or a work truck, we're committed to providing honest deals, transparent service, and a hassle-free buying experience."
- **Existing export messaging (from Facebook, Pashto):** AFCA already advertises exporting used vehicles from Canada to Dubai, Afghanistan, and worldwide — confirms the export line of business the client described.

## 2. Three service lines

1. **Local used vehicle sales** — targets students, newcomers to Canada, low-income families, and budget-conscious buyers who still want a recognizable/desirable brand. Tone: honest, affordable, no-pressure.
2. **Car parts sales** — positions AFCA as a parts source for local independent mechanics, individual DIYers, and other dealerships. This is a distinct B2B/B2C audience from service line 1 and needs its own catalog/search experience.
3. **Salvage & dismantled vehicle export** — sells salvage-title and dismantled vehicles to overseas buyers, primarily Eastern Europe, Africa, the Middle East (matches AFCA's existing Facebook messaging re: Dubai, Afghanistan), and beyond. Needs export-specific info (shipping/containers, documentation, wire payment terms) since buyers are overseas.

## 3. Sitemap

```
/ (Home / Landing)
/inventory (Local Used Cars for Sale)
  /inventory/:id (Vehicle detail page)
/parts (Car Parts Marketplace)
  /parts/:id (Part detail page)
/export (Salvage & Export Vehicles)
  /export/:id (Export vehicle detail page)
/auctions (Daily Auction Feed — gated)
/register (Create account)
/login (Sign in)
/account (Logged-in user's dashboard — saved auctions, account info)
/about (About AFCA)
/contact (Contact / location / hours)
/admin-login (Staff-only sign in)
/admin (Staff-only admin panel — post/edit/delete listings in every
  section, including photo upload; see "Admin panel" in README.md)
```

## 4. Landing page — section by section

The client was explicit that the landing page centers on two things:

**Section A — "Cars for Local Sale."**
A sliding image carousel (auto-advancing, swipeable) of current local inventory. Each slide has a **text-over-image overlay**: vehicle name/trim, price, and a short honest-deal tagline (e.g. "Great first car — $8,900"). Clicking a slide goes to that vehicle's detail page on `/inventory`. Below the carousel, a "Browse all local inventory" button.

**Section B — "Daily Auction Feed."**
A grid of auction-sourced vehicles, refreshed daily, showing photo, year/make/model, and auction close time. **The direct link to the actual auction listing is only shown to registered, logged-in AFCA accounts.** A logged-out visitor sees the same cards but with the link replaced by a "Log in or register to view auction link" call-to-action. This is the account-gating the client asked for.

Beneath both sections: a condensed pitch for the other two service lines (parts + export) with links to `/parts` and `/export`, since the landing page shouldn't try to carry all three businesses at full depth.

**Footer (site-wide):** address, hours `[TODO]`, phone `[TODO]`, email (sales@afcaauto.ca), and icon links to Facebook (live), Twitter/X `[TODO — handle needed]`, Instagram `[TODO — handle needed]`.

## 5. Page-by-page content outline

### `/inventory` — Local Used Cars
- Filter bar: price range, body type, budget-friendly flag
- Grid of vehicle cards (photo, price, mileage, "great for: first-time buyer / family / newcomer" tags)
- Each card links to a detail page with full photos, specs, financing-friendly messaging, and a "Contact about this vehicle" form

### `/parts` — Car Parts Marketplace
- Search/filter by make, model, part category (engine, body, electrical, etc.)
- Framed explicitly for **mechanics, individuals, and other dealerships** — messaging should speak to trade buyers, not just retail customers (e.g., bulk inquiry option, trade account note)
- Part detail page: condition, compatible vehicles, price, quantity, contact/order action

### `/export` — Salvage & Export Vehicles
- Explains the export process for overseas buyers: salvage/dismantled inventory, shipping regions served (Eastern Europe, Africa, Middle East, and beyond), what documentation is provided, general shipping/container process
- Vehicle grid similar to `/inventory` but tagged salvage/dismantled with condition notes
- Contact/inquiry form built for international buyers (country field, preferred contact method e.g. WhatsApp, since overseas buyers commonly prefer it)

### `/auctions` — Daily Auction Feed (gated)
- Same grid as the landing page's Section B, full list, updated daily
- Logged-out: teaser cards, no direct links, prominent register/login prompt
- Logged-in: full cards with the direct auction link exposed

### `/register` and `/login`
- Standard account creation/sign-in. Registration should ask at minimum: name, email, password, and (optionally) whether they're a local buyer, mechanic/dealer, or overseas buyer, so AFCA can tailor future communication.

### `/account`
- Basic dashboard: account details, maybe a "saved auction listings" list (nice-to-have, not required for v1)

### `/about`
- AFCA's story, the "honest deals, transparent service" positioning already used on Facebook, and a short explanation that AFCA operates across three lines of business (local sales, parts, export)

### `/contact`
- Address (13211 King George Blvd, Surrey, BC V3T 2T3), map embed, hours `[TODO]`, phone `[TODO]`, email, contact form

### `/admin-login` and `/admin` — Staff admin panel
- Separate login for staff accounts (role = `admin` in the `users` table); customers can never self-register into this role.
- `/admin` has one tab per section — Local Cars, Export/Salvage, Parts, Auction Feed — each with an add/edit form (including a photo upload) and a table of existing listings with edit/delete actions.
- The first admin account is bootstrapped via the `ADMIN_BOOTSTRAP_EMAIL` environment variable (register normally with that email, then set the variable and restart) — see README.md for the full procedure.
- Known limitation: on hosting free tiers without persistent disk (e.g. Render's free plan), uploaded photos and the database reset on every redeploy — a persistent disk (or external image storage) is needed before this is used for real, ongoing inventory management.

## 6. Open items before this can be called final

- [ ] Real phone number
- [ ] Confirmed hours (Facebook currently just says "Always open," which is likely an unset default rather than accurate)
- [ ] Twitter/X and Instagram handles
- [x] How listings get entered day-to-day — resolved: an admin panel (`/admin`) was built for this, replacing manual database edits as the primary path. The "Daily Cars" Google Drive automation is still an option to connect later if wanted.
