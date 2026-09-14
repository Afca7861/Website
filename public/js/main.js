// main.js — shared header/nav behavior and login-state display,
// loaded on every page.

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

async function apiFetch(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function money(n) {
  if (n === null || n === undefined) return "Contact for price";
  return "$" + Number(n).toLocaleString("en-CA");
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = qs(".nav-toggle");
  const nav = qs("nav.main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  const yearEl = qs("#footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const authArea = qs("#header-auth");
  if (authArea) {
    apiFetch("/api/auth/me")
      .then(({ user }) => {
        if (user) {
          authArea.innerHTML =
            `<span class="muted" style="font-size:13px;">Hi, ${escapeHtml(user.name.split(" ")[0])}</span>` +
            `<button class="btn btn-outline" id="logout-btn" type="button">Log out</button>`;
          qs("#logout-btn", authArea).addEventListener("click", async () => {
            await apiFetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          });
        } else {
          authArea.innerHTML =
            `<a class="btn btn-outline" href="/login.html">Log in</a>` +
            `<a class="btn btn-primary" href="/register.html">Register</a>`;
        }
      })
      .catch(() => {
        authArea.innerHTML =
          `<a class="btn btn-outline" href="/login.html">Log in</a>` +
          `<a class="btn btn-primary" href="/register.html">Register</a>`;
      });
  }
});
