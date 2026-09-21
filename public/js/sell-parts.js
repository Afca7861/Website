// sell-parts.js — the community Parts Seller portal: onboarding (become a
// seller), add/edit/delete your own part listings with multi-photo
// upload, and a table of what you've already listed. Every /api/seller/*
// call is re-checked server-side against the logged-in user's
// users.is_seller flag and seller_id ownership, so nothing here is a
// real security boundary — this script only drives the UI.

const FUEL_LABELS = { gas: "Gas", hybrid: "Hybrid", ev: "EV" };
const CONDITION_LABELS = { new: "New", used: "Used" };

let currentUser = null;
let editingId = null;
let pendingImageUrls = []; // uploaded so far for the form currently open
let rowCache = [];

async function guardSellPartsPage() {
  const { user } = await apiFetch("/api/auth/me");
  if (!user) {
    window.location.href = "/login.html?next=/sell-parts.html";
    return;
  }
  currentUser = user;
  qs("#sp-guard").hidden = true;

  if (!user.is_seller) {
    qs("#sp-onboarding").hidden = false;
    return;
  }
  qs("#sp-dashboard").hidden = false;
  qs("#sp-contact-phone").value = user.phone || "";
  qs("#sp-contact-email").value = user.email || "";
  qs("#sp-payout-phone").value = user.phone || "";
  qs("#sp-payout-paypal").value = user.paypal_email || "";
  qs("#sp-payout-postal").value = user.postal_code || "";
  loadMyParts();
  loadMySales();
}

function wireOnboarding() {
  const form = qs("#sp-onboard-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = qs("#sp-onboard-message");
    msg.innerHTML = "";
    try {
      await apiFetch("/api/auth/become-seller", {
        method: "POST",
        body: JSON.stringify({
          phone: form.phone.value,
          paypal_email: form.paypal_email.value,
          postal_code: form.postal_code.value,
        }),
      });
      window.location.reload();
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function wirePayoutForm() {
  const form = qs("#sp-payout-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = qs("#sp-payout-message");
    msg.innerHTML = "";
    try {
      await apiFetch("/api/seller/payout-info", {
        method: "PUT",
        body: JSON.stringify({
          phone: form.phone.value,
          paypal_email: form.paypal_email.value,
          postal_code: form.postal_code.value,
        }),
      });
      msg.innerHTML = `<div class="form-success">Payout settings saved.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

const SALE_STATUS_LABELS = {
  pending: "Awaiting payment",
  paid: "Paid out",
  payout_failed: "Sold — payout pending (contact AFCA)",
};

async function loadMySales() {
  const wrap = qs("#sp-orders-wrap");
  try {
    const { orders } = await apiFetch("/api/seller/orders");
    if (!orders.length) {
      wrap.innerHTML = `<p class="muted">Nothing sold yet.</p>`;
      return;
    }
    const rows = orders
      .map(
        (o) => `<tr>
          <td>${escapeHtml(o.part_title)}</td>
          <td>${money(o.part_price)}</td>
          <td>${o.fulfillment_method === "shipping" ? "Shipped" : "Pickup"}</td>
          <td>${money(o.seller_payout)}</td>
          <td><span class="badge ${o.status === "paid" ? "badge-green" : o.status === "payout_failed" ? "badge-red" : "badge-gray"}">${escapeHtml(SALE_STATUS_LABELS[o.status] || o.status)}</span></td>
          <td>${escapeHtml((o.created_at || "").slice(0, 10))}</td>
        </tr>`
      )
      .join("");
    wrap.innerHTML = `<table class="admin-table"><thead><tr>
      <th>Part</th><th>Price</th><th>Fulfillment</th><th>Your payout</th><th>Status</th><th>Date</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="form-error">Couldn't load your sales: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadMyParts() {
  const wrap = qs("#sp-table-wrap");
  try {
    const { parts } = await apiFetch("/api/seller/parts");
    rowCache = parts;
    renderTable(parts);
  } catch (err) {
    wrap.innerHTML = `<p class="form-error">Couldn't load your listings: ${escapeHtml(err.message)}</p>`;
  }
}

function statusPillClass(status) {
  if (status === "sold") return "badge-gray";
  if (status === "removed") return "badge-red";
  return "badge-green";
}

function renderTable(rows) {
  const wrap = qs("#sp-table-wrap");
  if (!rows.length) {
    wrap.innerHTML = `<p class="muted">You haven't listed any parts yet — use the form above.</p>`;
    return;
  }
  const body = rows
    .map((row) => {
      const thumb = row.images && row.images[0] ? row.images[0] : "/assets/placeholder-part.svg";
      const specs = [row.year_compat, row.make_compat, row.model_compat].filter(Boolean).join(" ");
      const tags = [
        row.condition_note && (CONDITION_LABELS[row.condition_note] || row.condition_note),
        row.fuel_type && (FUEL_LABELS[row.fuel_type] || row.fuel_type),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
        <td><img class="admin-thumb" src="${escapeHtml(thumb)}" alt=""></td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(specs || "—")}${tags ? `<br><span class="muted" style="font-size:12px;">${escapeHtml(tags)}</span>` : ""}</td>
        <td>${money(row.price)}</td>
        <td><span class="badge ${statusPillClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td class="admin-row-actions">
          <button type="button" class="btn btn-outline" data-edit="${row.id}">Edit</button>
          <button type="button" class="btn btn-outline" data-toggle="${row.id}">${row.status === "sold" ? "Mark active" : "Mark sold"}</button>
          <button type="button" class="btn btn-outline" data-delete="${row.id}">Delete</button>
        </td>
      </tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="admin-table"><thead><tr>
    <th>Photo</th><th>Part</th><th>Fits</th><th>Price</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${body}</tbody></table>`;

  qsa("[data-edit]", wrap).forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  qsa("[data-delete]", wrap).forEach((btn) => btn.addEventListener("click", () => deletePart(Number(btn.dataset.delete))));
  qsa("[data-toggle]", wrap).forEach((btn) => btn.addEventListener("click", () => toggleSold(Number(btn.dataset.toggle))));
}

function renderPreviews() {
  const target = qs("#sp-photo-previews");
  target.innerHTML = pendingImageUrls
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
      pendingImageUrls.splice(Number(btn.dataset.removePhoto), 1);
      renderPreviews();
    })
  );
}

async function uploadPhotos(files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("images", f));
  const res = await fetch("/api/seller/upload", { method: "POST", credentials: "same-origin", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.urls;
}

function startEdit(id) {
  const row = rowCache.find((r) => r.id === id);
  if (!row) return;
  editingId = id;
  const form = qs("#sp-part-form");
  form.elements.title.value = row.title || "";
  form.elements.price.value = row.price ?? "";
  form.elements.make_compat.value = row.make_compat || "";
  form.elements.model_compat.value = row.model_compat || "";
  form.elements.year_compat.value = row.year_compat ?? "";
  form.elements.fuel_type.value = row.fuel_type || "";
  form.elements.condition_note.value = row.condition_note || "";
  form.elements.quantity.value = row.quantity ?? 1;
  form.elements.contact_phone.value = row.contact_phone || currentUser.phone || "";
  form.elements.contact_email.value = row.contact_email || currentUser.email || "";
  form.elements.description.value = row.description || "";
  pendingImageUrls = (row.images || []).slice();
  renderPreviews();
  qs("#sp-form-heading").textContent = `Edit listing: ${row.title}`;
  qs("#sp-submit").textContent = "Save changes";
  qs("#sp-cancel").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  const form = qs("#sp-part-form");
  form.reset();
  form.elements.contact_phone.value = currentUser.phone || "";
  form.elements.contact_email.value = currentUser.email || "";
  form.elements.quantity.value = 1;
  pendingImageUrls = [];
  renderPreviews();
  qs("#sp-form-heading").textContent = "List a new part";
  qs("#sp-submit").textContent = "Add listing";
  qs("#sp-cancel").hidden = true;
}

async function deletePart(id) {
  if (!confirm("Delete this listing? This can't be undone.")) return;
  try {
    await apiFetch(`/api/seller/parts/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    loadMyParts();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleSold(id) {
  const row = rowCache.find((r) => r.id === id);
  if (!row) return;
  const nextStatus = row.status === "sold" ? "active" : "sold";
  try {
    await apiFetch(`/api/seller/parts/${id}`, { method: "PUT", body: JSON.stringify({ status: nextStatus }) });
    loadMyParts();
  } catch (err) {
    alert(err.message);
  }
}

function wireDashboard() {
  const form = qs("#sp-part-form");
  if (!form) return;
  const fileInput = qs("#sp-photos");
  const msg = qs("#sp-form-message");

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files.length) return;
    if (pendingImageUrls.length + fileInput.files.length > 8) {
      msg.innerHTML = `<div class="form-error">You can upload up to 8 photos per listing.</div>`;
      fileInput.value = "";
      return;
    }
    msg.innerHTML = `<p class="muted">Uploading photos…</p>`;
    try {
      const urls = await uploadPhotos(fileInput.files);
      pendingImageUrls = pendingImageUrls.concat(urls);
      renderPreviews();
      msg.innerHTML = "";
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
    fileInput.value = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const payload = {
      title: form.elements.title.value,
      price: form.elements.price.value === "" ? null : Number(form.elements.price.value),
      make_compat: form.elements.make_compat.value,
      model_compat: form.elements.model_compat.value,
      year_compat: form.elements.year_compat.value === "" ? null : Number(form.elements.year_compat.value),
      fuel_type: form.elements.fuel_type.value,
      condition_note: form.elements.condition_note.value,
      quantity: form.elements.quantity.value === "" ? 1 : Number(form.elements.quantity.value),
      contact_phone: form.elements.contact_phone.value,
      contact_email: form.elements.contact_email.value,
      description: form.elements.description.value,
      images: pendingImageUrls,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/seller/parts/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        msg.innerHTML = `<div class="form-success">Listing updated.</div>`;
      } else {
        await apiFetch("/api/seller/parts", { method: "POST", body: JSON.stringify(payload) });
        msg.innerHTML = `<div class="form-success">Listing added — it's live on the Parts Marketplace now.</div>`;
      }
      resetForm();
      loadMyParts();
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });

  qs("#sp-cancel").addEventListener("click", resetForm);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!qs("#sell-parts-app")) return;
  wireOnboarding();
  wireDashboard();
  wirePayoutForm();
  guardSellPartsPage();
});
