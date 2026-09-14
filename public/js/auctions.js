// auctions.js — renders the gated daily auction feed (Section B on the
// landing page, and the full list on /auctions.html). The server has
// already stripped auction_url for logged-out visitors, so the
// front-end never has the link to hide — it can only render what it
// was given.

function renderAuctionCard(a) {
  const linkArea = a.locked
    ? `<a class="auction-lock" href="/register.html">🔒 Log in to view link</a>`
    : `<a class="auction-link" href="${escapeHtml(a.auction_url)}" target="_blank" rel="noopener">View auction →</a>`;

  return `
    <div class="auction-card">
      <img src="${escapeHtml(a.image_url || "/assets/placeholder-car.svg")}" alt="${escapeHtml(a.title)}">
      <div class="meta">
        <strong>${escapeHtml(a.year || "")} ${escapeHtml(a.make || "")} ${escapeHtml(a.model || "")}</strong>
        <span>${escapeHtml(a.auction_source || "")} · Closes: ${escapeHtml(a.close_time || "TBD")}</span>
      </div>
      ${linkArea}
    </div>
  `;
}

async function loadAuctions(targetSelector, limit) {
  const target = qs(targetSelector);
  if (!target) return;
  target.innerHTML = `<p class="muted">Loading today's auction feed…</p>`;
  try {
    const { auctions, loggedIn } = await apiFetch("/api/auctions");
    const rows = limit ? auctions.slice(0, limit) : auctions;
    if (rows.length === 0) {
      target.innerHTML = `<p class="muted">No auction listings yet — check back soon.</p>`;
      return;
    }
    target.innerHTML = rows.map(renderAuctionCard).join("");
    if (!loggedIn) {
      target.insertAdjacentHTML(
        "beforeend",
        `<p class="helptext" style="margin-top:8px;">Direct auction links are only shown to registered AFCA accounts. <a href="/register.html">Register free</a> or <a href="/login.html">log in</a>.</p>`
      );
    }
  } catch (err) {
    target.innerHTML = `<p class="form-error">Couldn't load the auction feed: ${escapeHtml(err.message)}</p>`;
  }
}
