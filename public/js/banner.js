// banner.js — loads the homepage banner's photo/headline/subtext from
// /api/settings (set via the admin panel's "Site Banner" tab) and applies
// them over the default placeholder graphic. If nothing's been set yet
// (or the request fails), the placeholder graphic and default copy
// already in the page are left exactly as they are.

document.addEventListener("DOMContentLoaded", async () => {
  const banner = qs("#site-banner");
  if (!banner) return; // only present on the homepage

  try {
    const { settings } = await apiFetch("/api/settings");

    if (settings.banner_image_url) {
      banner.style.backgroundImage =
        "linear-gradient(135deg, rgba(17,17,17,0.4) 0%, rgba(90,25,20,0.3) 55%, rgba(110,28,20,0.2) 100%), " +
        `url('${settings.banner_image_url}')`;
    }

    // Whitespace-only headline/subtext (e.g. an admin clearing the field)
    // should hide the line entirely rather than leaving an empty gap.
    const headline = (settings.banner_headline || "").trim();
    const subtext = (settings.banner_subtext || "").trim();
    const headlineEl = qs("#banner-headline");
    const subtextEl = qs("#banner-subtext");

    if (headline) {
      headlineEl.textContent = headline;
      headlineEl.hidden = false;
    } else if (settings.banner_headline !== undefined) {
      headlineEl.hidden = true;
    }

    if (subtext) {
      subtextEl.textContent = subtext;
      subtextEl.hidden = false;
    } else if (settings.banner_subtext !== undefined) {
      subtextEl.hidden = true;
    }
  } catch (e) {
    // Fall back silently to the default placeholder banner already in the page.
  }
});
