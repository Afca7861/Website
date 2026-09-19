// carousel.js — Section A on the landing page: sliding local-inventory
// images with a text overlay (price + tagline), as the client asked for.

async function loadHeroCarousel(targetSelector) {
  const target = qs(targetSelector);
  if (!target) return;
  try {
    const { vehicles } = await apiFetch("/api/vehicles?category=local");
    const slides = vehicles.slice(0, 6);
    if (slides.length === 0) {
      target.innerHTML = `<p class="muted">No local inventory yet — check back soon.</p>`;
      return;
    }
    target.innerHTML = `
      <div class="carousel">
        <div class="carousel-track">
          ${slides
            .map(
              (v) => `
            <div class="carousel-slide">
              <img src="${escapeHtml(v.image_url || "/assets/placeholder-car.svg")}" alt="${escapeHtml(v.title)}">
              <a class="carousel-caption" href="/vehicle.html?id=${v.id}">
                <div class="price">${money(v.price)}</div>
                <div class="tagline">${escapeHtml(v.title)}</div>
              </a>
            </div>`
            )
            .join("")}
        </div>
        <button class="carousel-nav prev" type="button" aria-label="Previous">‹</button>
        <button class="carousel-nav next" type="button" aria-label="Next">›</button>
        <div class="carousel-dots">
          ${slides.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}
        </div>
      </div>
    `;

    const track = qs(".carousel-track", target);
    const dots = qsa(".carousel-dots span", target);
    let index = 0;
    const total = slides.length;

    function show(i) {
      index = (i + total) % total;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle("active", di === index));
    }

    qs(".carousel-nav.prev", target).addEventListener("click", () => show(index - 1));
    qs(".carousel-nav.next", target).addEventListener("click", () => show(index + 1));

    let timer = setInterval(() => show(index + 1), 5000);
    target.addEventListener("mouseenter", () => clearInterval(timer));
    target.addEventListener("mouseleave", () => {
      timer = setInterval(() => show(index + 1), 5000);
    });
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load inventory: ${escapeHtml(err.message)}</p>`;
  }
}
