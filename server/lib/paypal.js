// paypal.js — thin wrapper around the PayPal REST APIs used for the Car
// Parts checkout: Checkout Orders v2 (buyer payment) and Payouts v1
// (automatic 95% payout to the seller once payment is captured).
//
// Requires three environment variables, set in Render (or .env locally):
//   PAYPAL_CLIENT_ID     — from an AFCA PayPal Business/Developer app
//   PAYPAL_CLIENT_SECRET — same app, kept server-side only, never sent to
//                          the browser (contrast with PAYPAL_CLIENT_ID,
//                          which the checkout page's PayPal SDK script
//                          tag does need to see — see GET /api/payments/config)
//   PAYPAL_MODE          — "sandbox" (default) or "live". Leave this as
//                          "sandbox" until AFCA is ready to accept real
//                          money — sandbox uses PayPal's fake-money test
//                          environment against the exact same API shape,
//                          so nothing else about this file changes when
//                          you flip it to "live".
//
// All amounts in this module are plain JS numbers in dollars (e.g. 119.99),
// matching the rest of the app's convention — they're formatted to PayPal's
// required 2-decimal string form right before each request.

const PAYPAL_MODE = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
const BASE_URL =
  PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

function credentialsConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// Client-credentials OAuth token, cached in memory and refreshed a minute
// before it actually expires. PayPal tokens are normally valid ~9 hours,
// so in practice this fetches a fresh token once per server process
// lifetime (Render doesn't restart the process for every request).
let cachedToken = null; // { value, expiresAt }

async function getAccessToken() {
  if (!credentialsConfigured()) {
    throw new Error("PayPal isn't configured yet (missing PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET).");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    throw new Error("Could not authenticate with PayPal. " + (data && data.error_description ? data.error_description : ""));
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3000) * 1000 };
  return cachedToken.value;
}

async function paypalRequest(path, { method = "GET", body, idempotencyKey } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.message || data.error_description)) || `PayPal request failed (${res.status})`;
    const err = new Error(message);
    err.paypalResponse = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function money(amount) {
  return Number(amount).toFixed(2);
}

// Create a PayPal Checkout order for `amount` dollars. Returns the order
// id the frontend's PayPal Buttons createOrder() callback should hand
// back to PayPal — buyer approval and payment happen entirely inside
// PayPal's own UI/iframe, nothing sensitive ever touches AFCA's server.
async function createOrder({ amount, currency = "CAD", description, referenceId }) {
  const data = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: referenceId ? String(referenceId) : undefined,
          description: description ? String(description).slice(0, 127) : undefined,
          amount: { currency_code: currency, value: money(amount) },
        },
      ],
    },
  });
  return { id: data.id, status: data.status };
}

// Captures a buyer-approved order. Throws if PayPal refuses (e.g. the
// buyer never approved it, or it was already captured).
async function captureOrder(paypalOrderId) {
  const data = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    idempotencyKey: `capture-${paypalOrderId}`, // safe to retry the same capture call without double-charging
  });
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: data.status,
    captureId: capture ? capture.id : null,
    captureStatus: capture ? capture.status : null,
  };
}

// Sends `amount` dollars to receiverEmail via PayPal Payouts. This is what
// actually moves the seller's 95% out of AFCA's PayPal account. senderBatchId
// must be unique per attempt (used as PayPal's own idempotency key for the
// batch) — callers pass something derived from the local order id plus a
// retry counter so a manual "Retry payout" click is safe to repeat.
async function sendPayout({ receiverEmail, amount, currency = "CAD", note, senderBatchId, senderItemId }) {
  const data = await paypalRequest("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "You've been paid by AFCA Auto Sales Ltd.",
        email_message: note || "Payment for a car part sold through afcaauto.ca.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: money(amount), currency },
          receiver: receiverEmail,
          note: note || "AFCA Auto Sales — parts sale payout",
          sender_item_id: senderItemId,
        },
      ],
    },
  });
  return { batchId: data.batch_header?.payout_batch_id, batchStatus: data.batch_header?.batch_status };
}

module.exports = { credentialsConfigured, createOrder, captureOrder, sendPayout, PAYPAL_MODE };
