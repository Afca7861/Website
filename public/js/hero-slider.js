// hero-slider.js — homepage hero: a rotating promo slider (Soni Motors-
// style) instead of the old single static banner. Slide 1's photo/
// headline/subtext still come from the admin-editable Site Banner
// settings (same /api/settings the old banner.js read), so nothing an
// admin already set is lost; slides 2 and 3 are fixed promos for the
// Parts Marketplace and Export/Ship Cars lines of business. Pure
// client-side rotation — no dependency on any other script.

const HERO_AUTOPLAY_MS = 6000;

function heroSlideDefs(settings) {
  const bannerImage = (settings && settings.banner_image_url) || "/assets/banner-placeholder.svg";
  const bannerHeadline = ((settings && settings.banner_headline) || "").trim() ||
    "Honest deals on used cars, parts, and export vehicles.";
  const bannerSubtext = ((settings && settings.banner_subtext) || "").trim() ||
    "Serving Surrey and the Lower Mainland with reliable pre-owned vehicles, plus a parts marketplace for mechanics and dealers, and salvage/export vehicles shipped worldwide.";

  return [
    {
      image: bannerImage,
      eyebrow: "Local Inventory",
      headline: bannerHeadline,
      subtext: bannerSubtext,
      actions: [
        { label: "Browse Inventory", href: "/cars.html", primary: true },
        { label: "View Auction Feed", href: "/auctions.html" },
      ],
    },
    {
      image: "/assets/placeholder-part.svg",
      eyebrow: "For Mechanics & Dealers",
      headline: "Car Parts Marketplace",
      subtext: "Quality used and OEM parts from our own inventory, plus listings from community sellers — searchable by make, model, year, and fuel type.",
      actions: [
        { label: "Browse Parts", href: "/parts.html", primary: true },
        { label: "Sell Your Parts", href: "/sell-parts.html" },
      ],
    },
    {
      image: "/assets/placeholder-car.svg",
      eyebrow: "Worldwide Export",
      headline: "Salvage & Export Vehicles",
      subtext: "Salvage-title and dismantled vehicles shipped to Eastern Europe, Africa, the Middle East, and beyond, with full documentation.",
      actions: [
        { label: "Browse Export Inventory", href: "/export.html", primary: true },
      ],
    },
  ];
}

async function loadHeroSlider(targetSelector) {
  const target = qs(targetSelector);
  if (!target) return;

  let settings = {};
  try {
    ({ settings } = await apiFetch("/api/settings"));
  } catch (e) {
    // Fall back to defaults below if this fails.
  }

  const slides = heroSlideDefs(settings);

  target.innerHTML = `
    <div class="hero-slider">
      ${slides
        .map(
          (s, i) => `
        <div class="hero-slide${i === 0 ? " active" : ""}" style="background-image:url('${escapeHtml(s.image)}')">
          <div class="container hero-slide-inner">
            <span class="hero-slide-eyebrow">${escapeHtml(s.eyebrow)}</span>
            <h1>${escapeHtml(s.headline)}</h1>
            <p>${escapeHtml(s.subtext)}</p>
            <div class="hero-slide-actions">
              ${s.actions
                .map(
                  (a) =>
                    `<a class="btn ${a.primary ? "btn-primary" : "btn-outline"}" href="${escapeHtml(a.href)}"${
                      a.primary ? "" : ' style="border-color:#fff;color:#fff;"'
                    }>${escapeHtml(a.label)}</a>`
                )
                .join("")}
            </div>
          </div>
        </div>`
        )
        .join("")}
      <button class="hero-nav prev" type="button" aria-label="Previous slide">‹</button>
      <button class="hero-nav next" type="button" aria-label="Next slide">›</button>
      <div class="hero-dots">
        ${slides.map((_, i) => `<button type="button" class="${i === 0 ? "active" : ""}" aria-label="Go to slide ${i + 1}"></button>`).join("")}
      </div>
    </div>
  `;

  const wrap = qs(".hero-slider", target);
  const slideEls = qsa(".hero-slide", wrap);
  const dotEls = qsa(".hero-dots button", wrap);
  let index = 0;
  const total = slideEls.length;

  function show(i) {
    index = (i + total) % total;
    slideEls.forEach((el, si) => el.classList.toggle("active", si === index));
    dotEls.forEach((d, di) => d.classList.toggle("active", di === index));
  }

  qs(".hero-nav.prev", wrap).addEventListener("click", () => show(index - 1));
  qs(".hero-nav.next", wrap).addEventListener("click", () => show(index + 1));
  dotEls.forEach((d, i) => d.addEventListener("click", () => show(i)));

  let timer = setInterval(() => show(index + 1), HERO_AUTOPLAY_MS);
  wrap.addEventListener("mouseenter", () => clearInterval(timer));
  wrap.addEventListener("mouseleave", () => {
    timer = setInterval(() => show(index + 1), HERO_AUTOPLAY_MS);
  });
}
