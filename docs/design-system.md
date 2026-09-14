# AFCA Auto Sales Ltd — Design System
**Prepared by: the Website Graphics Designer role**

## Brand source

Colors and wordmark style are sampled directly from AFCA's existing Facebook page logo (profile photo), so the new website matches what customers already recognize: a bold "AFCA" wordmark with a red car-swoosh accent and a green underline detail, on white.

Note on the logo asset: I sampled the real logo's colors pixel-by-pixel from the Facebook image, but couldn't reliably transfer the exact compressed image file byte-for-byte through this session's tools. Rather than risk shipping a corrupted image, I rebuilt the wordmark as a crisp SVG using the sampled brand colors and the same layout (car swoosh + "AFCA" + "AUTO SALE LTD." lockup). It's included at `public/assets/logo.svg`. If you'd rather use the exact original file, drop your logo export into `public/assets/logo.svg` (or update the `<img>` src in the header partial) and it'll take over everywhere the logo appears.

## Color palette

| Token | Hex | Use |
|---|---|---|
| `--afca-red` | `#E10600` | Primary brand color — logo swoosh, primary buttons, price tags |
| `--afca-red-dark` | `#B00500` | Hover/active state for red elements |
| `--afca-black` | `#111111` | Wordmark text, headings, body text |
| `--afca-green` | `#0B6E1F` | Secondary accent — "verified/inspected" badges, success states, export-section accent |
| `--afca-white` | `#FFFFFF` | Backgrounds, reversed text |
| `--afca-gray-50` | `#F7F7F7` | Section backgrounds |
| `--afca-gray-200` | `#E5E5E5` | Borders, dividers |
| `--afca-gray-600` | `#5C5C5C` | Secondary/muted text |

Dark mode is not a priority for a car-sales storefront (customers expect a bright, trustworthy, catalog-like feel), so the palette is defined once and used consistently rather than swapped per theme.

## Typography

- **Headings:** a bold, condensed-leaning system sans (`"Arial Black", "Helvetica Neue", Arial, sans-serif`) to echo the blocky wordmark treatment.
- **Body/UI text:** a clean system sans (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) for readability across the parts catalog and listings.
- Scale: 14px base, 1.25 modular scale for headings (14 / 17.5 / 22 / 27 / 34 / 42px).

## Layout principles

- **Trust-first storefront, not a tech-startup landing page.** Real prices, real specs, real photos up front — this audience (budget buyers, mechanics, overseas exporters) wants information density over marketing flourish.
- Landing page is a **two-track layout**: local-sale carousel (Section A) and auction feed (Section B) sit side-by-side on desktop, stacked on mobile, so neither service line is buried.
- Card-based grids for inventory, parts, and export listings — consistent card shape across all three so the site feels like one system even though it serves three different businesses.
- Gated content (auction direct links) uses a **visible-but-blurred/lock-badge treatment** rather than hiding cards outright — shows logged-out visitors what they're missing, which is a stronger conversion driver for registration than a blank state.
- Mobile-first: this audience (newcomers, budget buyers, overseas buyers) skews toward mobile browsing. Nav collapses to a hamburger menu under 768px; carousels are swipeable; forms are single-column.

## Component notes

- **Buttons:** solid red for primary actions (Register, Contact About This Vehicle, Inquire), outlined black for secondary actions.
- **Badges:** green "Inspected" / "Verified" badge on local inventory cards; red "Salvage Title" badge on export cards; gray "OEM" / "Aftermarket" badge on parts cards.
- **Auction lock icon:** a simple padlock glyph over the auction link area for logged-out users, red on hover to invite the click into registration.
