// carousel.js — Section A on the landing page. Originally a single
// auto-sliding image with a price/tagline overlay; now shows the 3
// newest local listings side by side, each with its photo, price, and
// description underneath, so a visitor can see what's actually for
// sale without clicking through. Kept the function/file name
// (loadHeroCarousel / carousel.js) since index.html already calls it
// by that name and #hero-carousel is still the mount point.

async function loadHeroCarousel(targetSelector) {
  const target = qs(targetSelector);
  if (!target) return;
  try {
    const { vehicles } = await apiFetch("/api/vehicles?category=local");
    const cars = vehicles.slice(0, 3);
    if (cars.length === 0) {
      target.innerHTML = `<p class="muted">No local inventory yet — check back soon.</p>`;
      return;
    }
    // Each card has two separate links to the vehicle page (image, and
    // price/title) rather than one link wrapping the whole card — the
    // description below needs its own "See more" link, and an <a>
    // can't be nested inside another <a>.
    target.innerHTML = `
      <div class="hero-cars-grid">
        ${cars
          .map(
            (v) => `
          <div class="hero-car-card">
            <a class="hero-car-media" href="/vehicle.html?id=${v.id}">
              <img src="${escapeHtml(v.image_url || "/assets/placeholder-car.svg")}" alt="${escapeHtml(v.title)}">
            </a>
            <div class="hero-car-body">
              <a class="hero-car-title-link" href="/vehicle.html?id=${v.id}">
                <div class="price">${money(v.price)}</div>
                <div class="title">${escapeHtml(v.title)}</div>
              </a>
              ${v.description ? `<p class="desc">${escapeHtml(v.description)}</p>` : ""}
            </div>
          </div>`
          )
          .join("")}
      </div>
    `;

    // The description is CSS line-clamped (see .hero-car-card .desc) to
    // a fixed number of lines so all three cards stay the same height
    // no matter how long each vehicle's write-up is. Once that's
    // rendered, check which ones actually got clipped (scrollHeight >
    // clientHeight) and only those get a "See more…" link through to
    // the full listing — a short description that already fits fully
    // doesn't need one.
    qsa(".hero-car-card", target).forEach((card) => {
      const desc = qs(".desc", card);
      if (!desc) return;
      if (desc.scrollHeight > desc.clientHeight + 1) {
        const href = qs(".hero-car-media", card).getAttribute("href");
        desc.insertAdjacentHTML("afterend", `<a class="see-more" href="${href}">See more…</a>`);
      }
    });
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load inventory: ${escapeHtml(err.message)}</p>`;
  }
}
