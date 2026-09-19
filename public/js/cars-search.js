// cars-search.js — the Used Cars (local inventory) filter bar on
// cars.html. Body type / Condition / Year / Make / Model options are
// pulled live from /api/vehicles/facets (except Condition, a fixed
// controlled list, same as search.js uses on the homepage) so they
// always reflect real inventory. Also reads ?body_type=... from the URL
// on first load, so the homepage's quick-search chips (SUV, Sedan, etc.)
// land here pre-filtered.

const CARS_CONDITION_OPTIONS = ["Rebuilt", "Clean Title"];
const CARS_BODY_TYPES = ["SUV", "Sedan", "Hatchback", "Wagon", "Minivan", "Truck"];

function fillCarsSelect(select, values, anyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">${anyLabel}</option>` +
    (values || []).map((v) => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join("");
  if (current) select.value = current;
}

async function populateCarsFacets(form) {
  fillCarsSelect(form.elements.body_type, CARS_BODY_TYPES, "Any body type");
  fillCarsSelect(form.elements.condition, CARS_CONDITION_OPTIONS, "Any condition");
  try {
    const facets = await apiFetch("/api/vehicles/facets");
    fillCarsSelect(form.elements.year, facets.years, "Any year");
    fillCarsSelect(form.elements.make, facets.makes, "Any make");
    fillCarsSelect(form.elements.model, facets.models, "Any model");
  } catch (e) {
    // Leave year/make/model at their "Any" defaults if this fails.
  }
  const urlParams = new URLSearchParams(window.location.search);
  ["body_type", "condition", "year", "make", "model"].forEach((key) => {
    const val = urlParams.get(key);
    if (val && form.elements[key]) form.elements[key].value = val;
  });
}

function currentCarsQueryString(form) {
  const params = new URLSearchParams();
  ["body_type", "condition", "year", "make", "model"].forEach((key) => {
    const val = form.elements[key] && form.elements[key].value;
    if (val) params.set(key, val);
  });
  return params.toString();
}

function wireCarsSearch(formSelector, gridSelector) {
  const form = qs(formSelector);
  const grid = qs(gridSelector);
  if (!form || !grid) return;

  populateCarsFacets(form).then(() => loadVehicleGrid(gridSelector, "local", currentCarsQueryString(form)));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    loadVehicleGrid(gridSelector, "local", currentCarsQueryString(form));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireCarsSearch("#cars-search-form", "#vehicle-grid");
});
