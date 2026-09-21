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
    fields: ["title", "price", "year", "make", "model", "mileage", "condition_note", "body_type", "tags", "description"],
    numeric: ["price", "year", "mileage"],
    multiImage: true,
    maxPhotos: 12,
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
    fields: ["title", "price", "year", "make", "model", "mileage", "condition_note", "body_type", "tags", "description"],
    numeric: ["price", "year", "mileage"],
    multiImage: true,
    maxPhotos: 12,
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
// Photos uploaded so far for the local/export form currently open — the
// multi-photo sections (mirrors pendingImageUrls in public/js/sell-parts.js).
const pendingImages = { local: [], export: [] };

async function guardAdmin() {
  try {
    const { user } = await apiFetch("/api/auth/me");
    if (!user || user.role !== "admin") throw new Error("not admin");
    await apiFetch("/api/admin/check");
    qs("#admin-guard").hidden = true;
    qs("#admin-app").hidden = false;
    Object.keys(SECTIONS).forEach(loadSection);
    loadBannerSettings();
    loadCustomers();
    loadOrders();
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
  if (SECTIONS[name].multiImage) {
    pendingImages[name] = (row.images && row.images.length ? row.images : row.image_url ? [row.image_url] : []).slice();
    renderImagePreviews(name);
  } else {
    qs(`#preview-${name}`).src = row.image_url || form.querySelector(".admin-preview")?.src || "";
  }
  qs(`#submit-${name}`).textContent = "Save changes";
  qs(`#cancel-${name}`).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm(name) {
  editingId[name] = null;
  const form = qs(`#form-${name}`);
  form.reset();
  if (SECTIONS[name].multiImage) {
    pendingImages[name] = [];
    renderImagePreviews(name);
  } else {
    const defaultPreview = name === "parts" ? "/assets/placeholder-part.svg" : "/assets/placeholder-car.svg";
    form.elements.image_url.value = "";
    qs(`#preview-${name}`).src = defaultPreview;
  }
  qs(`#submit-${name}`).textContent = "Add listing";
  qs(`#cancel-${name}`).hidden = true;
}

// ---- Multi-photo listings (Local Cars / Export) — mirrors renderPreviews /
// uploadPhotos in public/js/sell-parts.js ----

function renderImagePreviews(name) {
  const target = qs(`#photo-previews-${name}`);
  if (!target) return;
  target.innerHTML = pendingImages[name]
    .map(
      (url, i) => `
      <div style="position:relative;">
        <img src="${escapeHtml(url)}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--afca-gray-200);">
        <button type="button" data-remove-photo="${i}" title="Remove" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--afca-black);color:#fff;font-size:12px;cursor:pointer;line-height:1;">×</button>
      </div>`
    )
    .join("");
  qsa("[data-remove-photo]", target).forEach((btn) =>
    btn.addEventListener("click", () => {
      pendingImages[name].splice(Number(btn.dataset.removePhoto), 1);
      renderImagePreviews(name);
    })
  );
}

async function uploadVehiclePhotos(files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("images", f));
  const res = await fetch("/api/admin/vehicles/upload", { method: "POST", credentials: "same-origin", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.urls;
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
  const msg = qs(`#msg-${name}`);

  if (cfg.multiImage) {
    const fileInput = qs(`#photos-${name}`);
    fileInput.addEventListener("change", async () => {
      if (!fileInput.files.length) return;
      const max = cfg.maxPhotos || 12;
      if (pendingImages[name].length + fileInput.files.length > max) {
        msg.innerHTML = `<div class="form-error">You can upload up to ${max} photos per listing.</div>`;
        fileInput.value = "";
        return;
      }
      msg.innerHTML = `<p class="muted">Uploading photos…</p>`;
      try {
        const urls = await uploadVehiclePhotos(fileInput.files);
        pendingImages[name] = pendingImages[name].concat(urls);
        renderImagePreviews(name);
        msg.innerHTML = "";
      } catch (err) {
        msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
      }
      fileInput.value = "";
    });
  } else {
    const fileInput = qs(`#image-${name}`);
    const preview = qs(`#preview-${name}`);
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
  }

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
    if (cfg.multiImage) payload.images = pendingImages[name];
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

// The three hero slides each get their own photo upload (fileInputId /
// hiddenFieldName), keyed by the settings row they read from in
// hero-slider.js. Slide 1 (Local Inventory) also has headline/subtext.
const BANNER_IMAGE_FIELDS = [
  { fileInputId: "image-banner", previewId: "preview-banner", hiddenField: "banner_image_url" },
  { fileInputId: "image-banner-parts", previewId: "preview-banner-parts", hiddenField: "parts_banner_image_url" },
  { fileInputId: "image-banner-export", previewId: "preview-banner-export", hiddenField: "export_banner_image_url" },
];

async function loadBannerSettings() {
  const form = qs("#form-banner");
  if (!form) return;
  try {
    const { settings } = await apiFetch("/api/admin/settings");
    if (settings.banner_headline) form.elements.banner_headline.value = settings.banner_headline;
    if (settings.banner_subtext) form.elements.banner_subtext.value = settings.banner_subtext;
    BANNER_IMAGE_FIELDS.forEach(({ previewId, hiddenField }) => {
      if (settings[hiddenField]) {
        form.elements[hiddenField].value = settings[hiddenField];
        qs(`#${previewId}`).src = settings[hiddenField];
      }
    });
  } catch (e) {
    // Leave the form at its defaults if this fails; saving still works.
  }
}

function wireBannerSection() {
  const form = qs("#form-banner");
  if (!form) return;
  const msg = qs("#msg-banner");

  BANNER_IMAGE_FIELDS.forEach(({ fileInputId, previewId, hiddenField }) => {
    const fileInput = qs(`#${fileInputId}`);
    const preview = qs(`#${previewId}`);
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      preview.src = URL.createObjectURL(file);
      msg.innerHTML = `<p class="muted">Uploading photo…</p>`;
      try {
        const url = await uploadImage(file);
        form.elements[hiddenField].value = url;
        msg.innerHTML = "";
      } catch (err) {
        msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const payload = {
      banner_headline: form.elements.banner_headline.value,
      banner_subtext: form.elements.banner_subtext.value,
    };
    BANNER_IMAGE_FIELDS.forEach(({ hiddenField }) => {
      payload[hiddenField] = form.elements[hiddenField].value;
    });
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
      msg.innerHTML = `<div class="form-success">Banner updated — check the homepage to see it live.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

// ---- Customers (every registered account, all three buyer categories:
// Local / Trade / Overseas — plus approving pending signups and removing
// accounts entirely; see the /users, /users/:id/approve, and /users/:id
// endpoints in server/routes/admin.js) ----

const BUYER_TYPE_LABELS = { local: "Local", trade: "Trade", overseas: "Overseas" };
const STATUS_LABELS = { pending: "Pending", approved: "Approved" };
let customersCache = [];

async function loadCustomers() {
  const target = qs("#table-customers");
  if (!target) return;
  try {
    const { users } = await apiFetch("/api/admin/users");
    customersCache = users;
    renderCustomersTable();
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load customers: ${escapeHtml(err.message)}</p>`;
  }
}

function filteredCustomers() {
  const category = qs("#customers-filter")?.value || "";
  const status = qs("#customers-status-filter")?.value || "";
  return customersCache.filter(
    (u) => (!category || u.buyer_type === category) && (!status || u.status === status)
  );
}

function formatJoinedDate(iso) {
  if (!iso) return "—";
  // SQLite's datetime('now') stores UTC with a space instead of "T" —
  // append Z so this parses as UTC rather than being reinterpreted in
  // the visitor's local timezone.
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function renderCustomersTable() {
  const target = qs("#table-customers");
  if (!target) return;
  const rows = filteredCustomers();
  const countEl = qs("#customers-count");
  if (countEl) {
    const category = qs("#customers-filter")?.value || "";
    const status = qs("#customers-status-filter")?.value || "";
    const bits = [category && BUYER_TYPE_LABELS[category], status && STATUS_LABELS[status]].filter(Boolean);
    const scope = bits.length ? ` (${bits.join(", ")})` : "";
    countEl.textContent = `${rows.length} registered customer${rows.length === 1 ? "" : "s"}${scope}`;
  }
  if (!rows.length) {
    target.innerHTML = `<p class="muted">No registered customers match this filter.</p>`;
    return;
  }
  const body = rows
    .map((u) => {
      const statusBadge = u.status === "pending"
        ? `<span class="badge badge-gray">Pending</span>`
        : `<span class="badge badge-green">Approved</span>`;
      const approveBtn = u.status === "pending"
        ? `<button type="button" class="btn btn-outline" data-approve="${u.id}">Approve</button>`
        : "";
      return `<tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone || "—")}</td>
        <td>${escapeHtml(BUYER_TYPE_LABELS[u.buyer_type] || u.buyer_type)}</td>
        <td>${statusBadge}</td>
        <td>${u.is_seller ? "Yes" : "No"}</td>
        <td>${escapeHtml(formatJoinedDate(u.created_at))}</td>
        <td class="admin-row-actions">
          ${approveBtn}
          <button type="button" class="btn btn-outline" data-remove-customer="${u.id}">Remove</button>
        </td>
      </tr>`;
    })
    .join("");
  target.innerHTML = `<table class="admin-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Category</th><th>Status</th><th>Parts Seller</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;

  qsa("[data-approve]", target).forEach((btn) =>
    btn.addEventListener("click", () => approveCustomer(Number(btn.dataset.approve)))
  );
  qsa("[data-remove-customer]", target).forEach((btn) =>
    btn.addEventListener("click", () => removeCustomer(Number(btn.dataset.removeCustomer)))
  );
}

async function approveCustomer(id) {
  try {
    await apiFetch(`/api/admin/users/${id}/approve`, { method: "POST" });
    await loadCustomers();
  } catch (err) {
    alert(err.message);
  }
}

async function removeCustomer(id) {
  const row = customersCache.find((u) => u.id === id);
  const label = row ? `${row.name} (${row.email})` : "this customer";
  if (!confirm(`Remove ${label}? This permanently deletes their account and can't be undone.`)) return;
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await loadCustomers();
  } catch (err) {
    alert(err.message);
  }
}

function csvField(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportCustomersCSV() {
  const rows = filteredCustomers();
  const header = ["Name", "Email", "Phone", "Category", "Status", "Parts Seller", "Joined"];
  const lines = [header.join(",")].concat(
    rows.map((u) =>
      [
        u.name,
        u.email,
        u.phone || "",
        BUYER_TYPE_LABELS[u.buyer_type] || u.buyer_type,
        STATUS_LABELS[u.status] || u.status,
        u.is_seller ? "Yes" : "No",
        u.created_at || "",
      ]
        .map(csvField)
        .join(",")
    )
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `afca-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireCustomers() {
  const filter = qs("#customers-filter");
  const statusFilter = qs("#customers-status-filter");
  const exportBtn = qs("#customers-export");
  if (filter) filter.addEventListener("change", renderCustomersTable);
  if (statusFilter) statusFilter.addEventListener("change", renderCustomersTable);
  if (exportBtn) exportBtn.addEventListener("click", exportCustomersCSV);
}

// ---- Orders (Car Parts checkout — see server/routes/orders.js) ----

const ORDER_STATUS_LABELS = { pending: "Awaiting payment", paid: "Paid", payout_failed: "Payout pending" };
let ordersCache = [];

async function loadOrders() {
  const target = qs("#table-orders");
  if (!target) return;
  try {
    const { orders } = await apiFetch("/api/admin/orders");
    ordersCache = orders;
    renderOrdersTable();
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load orders: ${escapeHtml(err.message)}</p>`;
  }
}

function filteredOrders() {
  const status = qs("#orders-status-filter")?.value || "";
  return ordersCache.filter((o) => !status || o.status === status);
}

function orderStatusBadge(status) {
  if (status === "paid") return `<span class="badge badge-green">Paid</span>`;
  if (status === "payout_failed") return `<span class="badge badge-red">Payout pending</span>`;
  return `<span class="badge badge-gray">Awaiting payment</span>`;
}

function renderOrdersTable() {
  const target = qs("#table-orders");
  if (!target) return;
  const rows = filteredOrders();
  const countEl = qs("#orders-count");
  if (countEl) {
    const status = qs("#orders-status-filter")?.value || "";
    const scope = status ? ` (${ORDER_STATUS_LABELS[status]})` : "";
    countEl.textContent = `${rows.length} order${rows.length === 1 ? "" : "s"}${scope}`;
  }
  if (!rows.length) {
    target.innerHTML = `<p class="muted">No orders match this filter.</p>`;
    return;
  }
  const body = rows
    .map((o) => {
      const seller = o.seller_id ? `${escapeHtml(o.seller_name || "—")}<br><span class="muted" style="font-size:12px;">${escapeHtml(o.seller_paypal_email || "no PayPal on file")}</span>` : `<span class="muted">AFCA (admin listing)</span>`;
      const retryBtn = o.status === "payout_failed"
        ? `<button type="button" class="btn btn-outline" data-retry-payout="${o.id}">Retry payout</button>`
        : "";
      return `<tr>
        <td>#${o.id}</td>
        <td>${escapeHtml(o.part_title)}</td>
        <td>${escapeHtml(o.buyer_name)}<br><span class="muted" style="font-size:12px;">${escapeHtml(o.buyer_email)}</span></td>
        <td>${seller}</td>
        <td>${o.fulfillment_method === "shipping" ? "Shipping" : "Pickup"}</td>
        <td>${money(o.total_amount)}</td>
        <td>${money(o.platform_fee + o.shipping_fee)}</td>
        <td>${o.seller_payout > 0 ? money(o.seller_payout) : "—"}</td>
        <td>${orderStatusBadge(o.status)}</td>
        <td>${escapeHtml(formatJoinedDate(o.created_at))}</td>
        <td class="admin-row-actions">${retryBtn}</td>
      </tr>`;
    })
    .join("");
  target.innerHTML = `<table class="admin-table">
    <thead><tr><th>#</th><th>Part</th><th>Buyer</th><th>Seller</th><th>Fulfillment</th><th>Total</th><th>AFCA's cut</th><th>Seller payout</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;

  qsa("[data-retry-payout]", target).forEach((btn) =>
    btn.addEventListener("click", () => retryPayout(Number(btn.dataset.retryPayout)))
  );
}

async function retryPayout(id) {
  try {
    await apiFetch(`/api/admin/orders/${id}/retry-payout`, { method: "POST" });
    await loadOrders();
  } catch (err) {
    alert(err.message);
  }
}

function wireOrders() {
  const statusFilter = qs("#orders-status-filter");
  if (statusFilter) statusFilter.addEventListener("change", renderOrdersTable);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!qs("#admin-app")) return; // not the admin page
  guardAdmin();
  Object.keys(SECTIONS).forEach(wireSection);
  wireBannerSection();
  wireCustomers();
  wireOrders();

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
