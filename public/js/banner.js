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
        "linear-gradient(135deg, rgba(17,17,17,0.72) 0%, rgba(176,5,0,0.62) 55%, rgba(225,6,0,0.5) 100%), " +
        `url('${settings.banner_image_url}')`;
    }
    if (settings.banner_headline) {
      qs("#banner-headline").textContent = settings.banner_headline;
    }
    if (settings.banner_subtext) {
      qs("#banner-subtext").textContent = settings.banner_subtext;
    }
  } catch (e) {
    // Fall back silently to the default placeholder banner already in the page.
  }
});
