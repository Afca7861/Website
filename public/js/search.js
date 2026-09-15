// search.js — the homepage inventory search row (Condition / Year / Make /
// Model) and the /search.html results page it submits to. Year, Make, and
// Model options are pulled live from whatever's actually in the vehicles
// table (via /api/vehicles/facets), so they always match real inventory.
// Condition is a fixed list — kept in sync with the two options the admin
// panel's Local Cars form allows (see public/admin.html) — rather than
// pulled from data, so it stays a clean, controlled pair of choices.

const CONDITION_OPTIONS = ["Rebuilt", "Clean Title"];

function fillSelect(select, values, anyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">${anyLabel}</option>` +
    (values || []).map((v) => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join("");
  if (current) select.value = current;
}

// Populates the four dropdowns, then (if the current URL already has
// search params, as on the results page) pre-selects them.
async function populateSearchFacets(form) {
  fillSelect(form.elements.condition, CONDITION_OPTIONS, "Any condition");
  try {
    const facets = await apiFetch("/api/vehicles/facets");
    fillSelect(form.elements.year, facets.years, "Any year");
    fillSelect(form.elements.make, facets.makes, "Any make");
    fillSelect(form.elements.model, facets.models, "Any model");
  } catch (e) {
    // Leave year/make/model at their "Any" defaults if this fails.
  }
  const urlParams = new URLSearchParams(window.location.search);
  ["condition", "year", "make", "model"].forEach((key) => {
    const val = urlParams.get(key);
    if (val && form.elements[key]) form.elements[key].value = val;
  });
}

// Wires up any <form id="inventory-search-form"> on the page: fills its
// dropdowns and sends a submit to /search.html with the chosen filters as
// query params. Safe to call on both the homepage and the results page.
function wireInventorySearch(formSelector) {
  const form = qs(formSelector);
  if (!form) return;
  populateSearchFacets(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    ["condition", "year", "make", "model"].forEach((key) => {
      const val = form.elements[key].value;
      if (val) params.set(key, val);
    });
    window.location.href = "/search.html" + (params.toString() ? `?${params.toString()}` : "");
  });
}

// Results-page grid: reads filters from the URL, shows a summary line,
// and loads matching vehicles across both local and export/salvage stock.
async function runInventorySearch(gridSelector, summarySelector) {
  const target = qs(gridSelector);
  if (!target) return;

  const pageParams = new URLSearchParams(window.location.search);
  const filters = ["condition", "year", "make", "model"].map((k) => pageParams.get(k)).filter(Boolean);

  const summary = summarySelector ? qs(summarySelector) : null;
  if (summary) {
    summary.textContent = filters.length
      ? `Showing results for: ${filters.join(" · ")}`
      : "Showing all inventory — local sale and export/salvage.";
  }

  const apiParams = new URLSearchParams(pageParams);
  apiParams.set("category", "all");

  target.innerHTML = `<p class="muted">Searching inventory…</p>`;
  try {
    const { vehicles } = await apiFetch(`/api/vehicles?${apiParams.toString()}`);
    if (vehicles.length === 0) {
      target.innerHTML = `<p class="muted">No vehicles match those filters — try broadening your search.</p>`;
      return;
    }
    target.innerHTML = vehicles.map((v) => vehicleCard(v, { category: v.category })).join("");
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load results: ${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wireInventorySearch("#inventory-search-form");
});
