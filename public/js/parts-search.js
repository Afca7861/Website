// parts-search.js — the Car Parts Marketplace search/filter bar on
// parts.html. Make/Model/Year/Fuel-type options are pulled live from
// /api/parts/facets so they always match real listings (both admin-posted
// and community Parts Seller listings). Condition and Fuel type are fixed
// lists since those are controlled vocabularies, not free text.

const PART_CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];
const PART_FUEL_OPTIONS = [
  { value: "gas", label: "Gas" },
  { value: "hybrid", label: "Hybrid" },
  { value: "ev", label: "EV" },
];

function fillPartsSelect(select, options, anyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">${anyLabel}</option>` +
    options.map((o) => `<option value="${escapeHtml(String(o.value))}">${escapeHtml(String(o.label))}</option>`).join("");
  if (current) select.value = current;
}

function fillPartsSelectFromValues(select, values, anyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">${anyLabel}</option>` +
    (values || []).map((v) => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join("");
  if (current) select.value = current;
}

async function populatePartsFacets(form) {
  fillPartsSelectFromValues(form.elements.make, [], "Any make");
  fillPartsSelectFromValues(form.elements.model, [], "Any model");
  fillPartsSelect(form.elements.fuel_type, PART_FUEL_OPTIONS, "Any fuel type");
  fillPartsSelect(form.elements.condition, PART_CONDITION_OPTIONS, "Any condition");
  try {
    const facets = await apiFetch("/api/parts/facets");
    fillPartsSelectFromValues(form.elements.make, facets.makes, "Any make");
    fillPartsSelectFromValues(form.elements.model, facets.models, "Any model");
    fillPartsSelectFromValues(form.elements.year, facets.years, "Any year");
  } catch (e) {
    // Leave dropdowns at their defaults if this fails.
  }
  const urlParams = new URLSearchParams(window.location.search);
  ["q", "make", "model", "year", "fuel_type", "condition"].forEach((key) => {
    const val = urlParams.get(key);
    if (val && form.elements[key]) form.elements[key].value = val;
  });
}

function currentPartsQueryString(form) {
  const params = new URLSearchParams();
  ["q", "make", "model", "year", "fuel_type", "condition"].forEach((key) => {
    const val = form.elements[key] && form.elements[key].value;
    if (val) params.set(key, val);
  });
  return params.toString();
}

function wirePartsSearch(formSelector, gridSelector) {
  const form = qs(formSelector);
  const grid = qs(gridSelector);
  if (!form || !grid) return;

  populatePartsFacets(form).then(() => loadPartsGrid(gridSelector, currentPartsQueryString(form)));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    loadPartsGrid(gridSelector, currentPartsQueryString(form));
  });
}

// If the visitor is already logged in, point the "Sign in to your Parts
// account" button straight at the seller portal instead of the login page
// — sell-parts.html itself handles onboarding vs. dashboard from there.
async function wirePartsAccountButton() {
  const btn = qs("#parts-account-btn");
  if (!btn) return;
  try {
    const { user } = await apiFetch("/api/auth/me");
    if (user) {
      btn.href = "/sell-parts.html";
      btn.textContent = user.is_seller ? "Go to your Parts account" : "Manage your Parts account";
    }
  } catch (e) {
    // Not logged in (or the check failed) — leave the sign-in link as-is.
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wirePartsSearch("#parts-search-form", "#parts-grid");
  wirePartsAccountButton();
});
