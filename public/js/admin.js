// admin.js — AFCA admin panel: create/edit/delete listings across all
// four site sections, plus photo uploads. This script only drives the
// UI; every /api/admin/* request is re-checked server-side against the
// logged-in user's role, so nothing here is a real security boundary.

const SECTIONS = {
  local: {
    api: "/api/admin/vehicles",
    key: "vehicles",
    filter: (row) => row.category === "local",
    fixed: { category: "local" },
    fields: ["title", "price", "year", "make", "model", "mileage", "condition_note", "body_type", "tags", "description", "image_url"],
    numeric: ["price", "year", "mileage"],
    columns: [
      { key: "title", label: "Title" },
      { key: "price", label: "Price", fmt: money },
      { key: "year", label: "Year" },
    ],
  },
  export: {
    api: "/api/admin/vehicles",
    key: "vehicles",
    filter: (row) => row.category === "export",
    fixed: { category: "export" },
    fields: ["title", "price", "year", "make", "model", "mileage", "condition_note", "body_type", "tags", "description", "image_url"],
    numeric: ["price", "year", "mileage"],
    columns: [
      { key: "title", label: "Title" },
      { key: "price", label: "Price", fmt: money },
      { key: "year", label: "Year" },
    ],
  },
  parts: {
    api: "/api/admin/parts",
    key: "parts",
    filter: () => true,
    fixed: {},
    fields: ["title", "category", "make_compat", "model_compat", "condition_note", "price", "quantity", "description", "image_url"],
    numeric: ["price", "quantity"],
    columns: [
      { key: "title", label: "Title" },
      { key: "price", label: "Price", fmt: money },
      { key: "quantity", label: "Qty" },
    ],
  },
  auctions: {
    api: "/api/admin/auctions",
    key: "auctions",
    filter: () => true,
    fixed: {},
    fields: ["title", "year", "make", "model", "auction_source", "close_time", "auction_url", "image_url"],
    numeric: ["year"],
    columns: [
      { key: "title", label: "Title" },
      { key: "auction_source", label: "Source" },
      { key: "close_time", label: "Closes" },
    ],
  },
};

const editingId = { local: null, export: null, parts: null, auctions: null };
const rowCache = { local: [], export: [], parts: [], auctions: [] };

async function guardAdmin() {
  try {
    const { user } = await apiFetch("/api/auth/me");
    if (!user || user.role !== "admin") throw new Error("not admin");
    await apiFetch("/api/admin/check");
    qs("#admin-guard").hidden = true;
    qs("#admin-app").hidden = false;
    Object.keys(SECTIONS).forEach(loadSection);
    loadBannerSettings();
  } catch (e) {
    qs("#admin-guard").innerHTML =
      `<div class="form-error">You need an admin account to view this page. <a href="/admin-login.html">Sign in as admin</a></div>`;
  }
}

async function loadSection(name) {
  const cfg = SECTIONS[name];
  const data = await apiFetch(cfg.api);
  const rows = data[cfg.key].filter(cfg.filter);
  rowCache[name] = rows;
  renderTable(name, rows);
}

function renderTable(name, rows) {
  const cfg = SECTIONS[name];
  const target = qs(`#table-${name}`);
  if (!rows.length) {
    target.innerHTML = `<p class="muted">No listings yet — add one above.</p>`;
    return;
  }
  const head = cfg.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = cfg.columns
        .map((c) => `<td>${escapeHtml(c.fmt ? c.fmt(row[c.key]) : row[c.key] ?? "")}</td>`)
        .join("");
      return `<tr>
        <td><img class="admin-thumb" src="${escapeHtml(row.image_url || "/assets/placeholder-car.svg")}" alt=""></td>
        ${cells}
        <td class="admin-row-actions">
          <button type="button" class="btn btn-outline" data-edit="${row.id}">Edit</button>
          <button type="button" class="btn btn-outline" data-delete="${row.id}">Delete</button>
        </td>
      </tr>`;
    })
    .join("");
  target.innerHTML = `<table class="admin-table"><thead><tr><th>Photo</th>${head}<th>Actions</th></tr></thead><tbody>${body}</tbody></table>`;

  qsa("[data-edit]", target).forEach((btn) =>
    btn.addEventListener("click", () => startEdit(name, Number(btn.dataset.edit)))
  );
  qsa("[data-delete]", target).forEach((btn) =>
    btn.addEventListener("click", () => deleteRow(name, Number(btn.dataset.delete)))
  );
}

function startEdit(name, id) {
  const row = rowCache[name].find((r) => r.id === id);
  if (!row) return;
  editingId[name] = id;
  const form = qs(`#form-${name}`);
  SECTIONS[name].fields.forEach((f) => {
    if (form.elements[f]) form.elements[f].value = row[f] ?? "";
  });
  qs(`#preview-${name}`).src = row.image_url || form.querySelector(".admin-preview")?.src || "";
  qs(`#submit-${name}`).textContent = "Save changes";
  qs(`#cancel-${name}`).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm(name) {
  editingId[name] = null;
  const form = qs(`#form-${name}`);
  const defaultPreview = name === "parts" ? "/assets/placeholder-part.svg" : "/assets/placeholder-car.svg";
  form.reset();
  form.elements.image_url.value = "";
  qs(`#preview-${name}`).src = defaultPreview;
  qs(`#submit-${name}`).textContent = "Add listing";
  qs(`#cancel-${name}`).hidden = true;
}

async function deleteRow(name, id) {
  if (!confirm("Delete this listing? This can't be undone.")) return;
  try {
    await apiFetch(`${SECTIONS[name].api}/${id}`, { method: "DELETE" });
    if (editingId[name] === id) resetForm(name);
    loadSection(name);
  } catch (err) {
    alert(err.message);
  }
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/admin/upload", { method: "POST", credentials: "same-origin", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.url;
}

function wireSection(name) {
  const cfg = SECTIONS[name];
  const form = qs(`#form-${name}`);
  const fileInput = qs(`#image-${name}`);
  const preview = qs(`#preview-${name}`);
  const msg = qs(`#msg-${name}`);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    msg.innerHTML = `<p class="muted">Uploading photo…</p>`;
    try {
      const url = await uploadImage(file);
      form.elements.image_url.value = url;
      msg.innerHTML = "";
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const payload = { ...cfg.fixed };
    cfg.fields.forEach((f) => {
      payload[f] = form.elements[f] ? form.elements[f].value : undefined;
    });
    cfg.numeric.forEach((f) => {
      if (payload[f] !== undefined && payload[f] !== "") payload[f] = Number(payload[f]);
    });
    try {
      const id = editingId[name];
      if (id) {
        await apiFetch(`${cfg.api}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        msg.innerHTML = `<div class="form-success">Listing updated.</div>`;
      } else {
        await apiFetch(cfg.api, { method: "POST", body: JSON.stringify(payload) });
        msg.innerHTML = `<div class="form-success">Listing added.</div>`;
      }
      resetForm(name);
      loadSection(name);
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });

  qs(`#cancel-${name}`).addEventListener("click", () => resetForm(name));
}

// ---- Site banner (single settings record, not a list — handled separately
// from the SECTIONS engine above) ----

async function loadBannerSettings() {
  const form = qs("#form-banner");
  if (!form) return;
  try {
    const { settings } = await apiFetch("/api/admin/settings");
    if (settings.banner_headline) form.elements.banner_headline.value = settings.banner_headline;
    if (settings.banner_subtext) form.elements.banner_subtext.value = settings.banner_subtext;
    if (settings.banner_image_url) {
      form.elements.banner_image_url.value = settings.banner_image_url;
      qs("#preview-banner").src = settings.banner_image_url;
    }
  } catch (e) {
    // Leave the form at its defaults if this fails; saving still works.
  }
}

function wireBannerSection() {
  const form = qs("#form-banner");
  if (!form) return;
  const fileInput = qs("#image-banner");
  const preview = qs("#preview-banner");
  const msg = qs("#msg-banner");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    msg.innerHTML = `<p class="muted">Uploading photo…</p>`;
    try {
      const url = await uploadImage(file);
      form.elements.banner_image_url.value = url;
      msg.innerHTML = "";
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const payload = {
      banner_image_url: form.elements.banner_image_url.value,
      banner_headline: form.elements.banner_headline.value,
      banner_subtext: form.elements.banner_subtext.value,
    };
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
      msg.innerHTML = `<div class="form-success">Banner updated — check the homepage to see it live.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!qs("#admin-app")) return; // not the admin page
  guardAdmin();
  Object.keys(SECTIONS).forEach(wireSection);
  wireBannerSection();

  qsa(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa(".admin-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      qsa(".admin-panel").forEach((p) => {
        p.hidden = p.dataset.panel !== btn.dataset.tab;
      });
    });
  });
});
