// carousel.js — Section A on the landing page. Originally a single
// auto-sliding image with a price/tagline overlay; now shows the 3
// newest local listings side by side, each with its photo, price, and
// full description underneath, so a visitor can see what's actually
// for sale without clicking through. Kept the function/file name
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
    target.innerHTML = `
      <div class="hero-cars-grid">
        ${cars
          .map(
            (v) => `
          <a class="hero-car-card" href="/vehicle.html?id=${v.id}">
            <img src="${escapeHtml(v.image_url || "/assets/placeholder-car.svg")}" alt="${escapeHtml(v.title)}">
            <div class="hero-car-body">
              <div class="price">${money(v.price)}</div>
              <div class="title">${escapeHtml(v.title)}</div>
              ${v.description ? `<p class="desc">${escapeHtml(v.description)}</p>` : ""}
            </div>
          </a>`
          )
          .join("")}
      </div>
    `;
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load inventory: ${escapeHtml(err.message)}</p>`;
  }
}
