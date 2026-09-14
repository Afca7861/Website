// listings.js — shared rendering for vehicle and parts grids, used by
// cars.html, export.html, and parts.html.

function vehicleCard(v, opts) {
  opts = opts || {};
  const badge = opts.category === "export"
    ? `<span class="badge badge-red">${escapeHtml(v.condition_note || "Salvage")}</span>`
    : `<span class="badge badge-green">${escapeHtml(v.condition_note || "Inspected")}</span>`;
  return `
    <a class="card" href="/vehicle.html?id=${v.id}" style="color:inherit;">
      <img src="${escapeHtml(v.image_url || "/assets/placeholder-car.svg")}" alt="${escapeHtml(v.title)}">
      <div class="card-body">
        ${badge}
        <strong>${escapeHtml(v.title)}</strong>
        <span class="price">${money(v.price)}</span>
        <span class="specs">${v.year || ""} · ${escapeHtml(v.make || "")} ${escapeHtml(v.model || "")} · ${v.mileage ? v.mileage.toLocaleString() + " km" : "mileage n/a"}</span>
      </div>
    </a>
  `;
}

function partCard(p) {
  return `
    <a class="card" href="/part.html?id=${p.id}" style="color:inherit;">
      <img src="${escapeHtml(p.image_url || "/assets/placeholder-part.svg")}" alt="${escapeHtml(p.title)}">
      <div class="card-body">
        <span class="badge badge-gray">${escapeHtml(p.condition_note || "Used")}</span>
        <strong>${escapeHtml(p.title)}</strong>
        <span class="price">${money(p.price)}</span>
        <span class="specs">Fits: ${escapeHtml(p.make_compat || "")} ${escapeHtml(p.model_compat || "")} · Qty: ${p.quantity ?? "n/a"}</span>
      </div>
    </a>
  `;
}

async function loadVehicleGrid(targetSelector, category) {
  const target = qs(targetSelector);
  if (!target) return;
  target.innerHTML = `<p class="muted">Loading inventory…</p>`;
  try {
    const { vehicles } = await apiFetch(`/api/vehicles?category=${encodeURIComponent(category)}`);
    if (vehicles.length === 0) {
      target.innerHTML = `<p class="muted">No listings yet — check back soon.</p>`;
      return;
    }
    target.innerHTML = vehicles.map((v) => vehicleCard(v, { category })).join("");
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load inventory: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadPartsGrid(targetSelector) {
  const target = qs(targetSelector);
  if (!target) return;
  target.innerHTML = `<p class="muted">Loading parts catalog…</p>`;
  try {
    const { parts } = await apiFetch("/api/parts");
    if (parts.length === 0) {
      target.innerHTML = `<p class="muted">No parts listed yet — check back soon.</p>`;
      return;
    }
    target.innerHTML = parts.map(partCard).join("");
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load parts: ${escapeHtml(err.message)}</p>`;
  }
}
