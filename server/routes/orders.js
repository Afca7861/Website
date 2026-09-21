// orders.js — Car Parts checkout: buyers (no account required) pay a
// seller directly through PayPal, with 5% of the part price plus a flat
// $20 local-shipping surcharge automatically kept by AFCA, and the
// remaining 95% of the part price sent straight to the seller's own
// PayPal account. See server/lib/paypal.js for the payment plumbing and
// server/lib/geo.js for the 50km shipping-eligibility check.
//
// Nothing here requires req.session.userId — "People who buy don't have
// to be registered" was explicit in the spec, so every route below is
// public. A part's *seller* does need an account (to receive payouts),
// but the buyer never does.

const express = require("express");
const db = require("../db");
const paypal = require("../lib/paypal");
const geo = require("../lib/geo");

const router = express.Router();

const SHIPPING_FEE = 20; // flat, entirely AFCA's — see orders table comment in db.js
const PLATFORM_FEE_RATE = 0.05;
const MAX_SHIPPING_KM = 50;
// Used as the shipping origin for admin-posted parts (seller_id NULL),
// where there's no seller postal code on file — AFCA's own address.
const AFCA_ORIGIN_POSTAL = "V3T 2T3";
const CURRENCY = "CAD";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loadPurchasablePart(id) {
  const part = db.prepare("SELECT * FROM parts WHERE id = ?").get(id);
  if (!part) return { error: "Part not found." };
  if (part.status !== "active") return { error: "This part is no longer available." };
  if (!(part.quantity > 0)) return { error: "This part is out of stock." };
  if (!(part.price > 0)) return { error: "This part doesn't have a price set yet — contact the seller instead." };
  return { part };
}

function originPostalForPart(part) {
  if (part.seller_id) {
    const seller = db.prepare("SELECT postal_code FROM users WHERE id = ?").get(part.seller_id);
    return (seller && seller.postal_code) || null;
  }
  return AFCA_ORIGIN_POSTAL;
}

// Public config the checkout page's PayPal SDK script tag needs — just the
// client id (meant to be public, same as any "publishable key") and the
// currency. Never exposes PAYPAL_CLIENT_SECRET.
router.get("/payments/config", (req, res) => {
  res.json({
    configured: paypal.credentialsConfigured(),
    clientId: process.env.PAYPAL_CLIENT_ID || null,
    currency: CURRENCY,
    shippingFee: SHIPPING_FEE,
    maxShippingKm: MAX_SHIPPING_KM,
  });
});

// Live "is shipping available to this postal code" check, used by the
// checkout form before the buyer commits to anything. The authoritative
// check happens again in POST /orders regardless — this is just for
// immediate feedback in the UI.
router.get("/parts/:id/shipping-check", async (req, res) => {
  const { part, error } = loadPurchasablePart(req.params.id);
  if (error) return res.status(404).json({ error });
  const originPostal = originPostalForPart(part);
  if (!originPostal) {
    return res.json({ eligible: false, distanceKm: null, reason: "seller_no_postal_code" });
  }
  const result = await geo.checkShippingEligibility(originPostal, req.query.postal_code, MAX_SHIPPING_KM);
  res.json(result);
});

router.post("/orders", async (req, res) => {
  const {
    part_id,
    fulfillment_method,
    buyer_name,
    buyer_email,
    buyer_phone,
    shipping_address,
    shipping_postal_code,
  } = req.body || {};

  if (!["pickup", "shipping"].includes(fulfillment_method)) {
    return res.status(400).json({ error: "Choose pickup or shipping." });
  }
  if (!String(buyer_name || "").trim()) return res.status(400).json({ error: "Your name is required." });
  if (!isValidEmail(buyer_email)) return res.status(400).json({ error: "A valid email is required." });

  const { part, error } = loadPurchasablePart(part_id);
  if (error) return res.status(404).json({ error });

  let distanceKm = null;
  if (fulfillment_method === "shipping") {
    if (!String(shipping_address || "").trim() || !String(shipping_postal_code || "").trim()) {
      return res.status(400).json({ error: "A shipping address and postal code are required." });
    }
    const originPostal = originPostalForPart(part);
    if (!originPostal) {
      return res.status(400).json({ error: "This seller hasn't set a pickup location yet, so shipping isn't available — please choose pickup or contact the seller." });
    }
    const check = await geo.checkShippingEligibility(originPostal, shipping_postal_code, MAX_SHIPPING_KM);
    if (!check.eligible) {
      return res.status(400).json({
        error: check.distanceKm != null
          ? `Shipping is only available within ${MAX_SHIPPING_KM}km of the seller (this is about ${check.distanceKm}km away). Try pickup instead.`
          : "Couldn't verify that postal code is within the shipping area. Try pickup instead, or double-check the postal code.",
      });
    }
    distanceKm = check.distanceKm;
  }

  if (!paypal.credentialsConfigured()) {
    return res.status(503).json({ error: "Online payments aren't set up yet — please contact AFCA directly about this part." });
  }

  const shippingFee = fulfillment_method === "shipping" ? SHIPPING_FEE : 0;
  const platformFee = round2(part.price * PLATFORM_FEE_RATE);
  const sellerPayout = part.seller_id ? round2(part.price - platformFee) : 0;
  const totalAmount = round2(part.price + shippingFee);

  const info = db
    .prepare(
      `INSERT INTO orders
        (part_id, seller_id, part_title, part_price, fulfillment_method, shipping_fee, platform_fee,
         seller_payout, total_amount, buyer_name, buyer_email, buyer_phone, shipping_address,
         shipping_postal_code, distance_km, status)
       VALUES
        (@part_id, @seller_id, @part_title, @part_price, @fulfillment_method, @shipping_fee, @platform_fee,
         @seller_payout, @total_amount, @buyer_name, @buyer_email, @buyer_phone, @shipping_address,
         @shipping_postal_code, @distance_km, 'pending')`
    )
    .run({
      part_id: part.id,
      seller_id: part.seller_id || null,
      part_title: part.title,
      part_price: part.price,
      fulfillment_method,
      shipping_fee: shippingFee,
      platform_fee: platformFee,
      seller_payout: sellerPayout,
      total_amount: totalAmount,
      buyer_name: String(buyer_name).trim(),
      buyer_email: String(buyer_email).trim().toLowerCase(),
      buyer_phone: buyer_phone ? String(buyer_phone).trim() : null,
      shipping_address: fulfillment_method === "shipping" ? String(shipping_address).trim() : null,
      shipping_postal_code: fulfillment_method === "shipping" ? String(shipping_postal_code).trim() : null,
      distance_km: distanceKm,
    });
  const orderId = info.lastInsertRowid;

  try {
    const paypalOrder = await paypal.createOrder({
      amount: totalAmount,
      currency: CURRENCY,
      description: `AFCA part: ${part.title}`.slice(0, 127),
      referenceId: orderId,
    });
    db.prepare("UPDATE orders SET paypal_order_id = ? WHERE id = ?").run(paypalOrder.id, orderId);
    res.status(201).json({ order_id: orderId, paypal_order_id: paypalOrder.id, total_amount: totalAmount });
  } catch (err) {
    console.error("PayPal create order error:", err.message);
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId); // never leave a dead 'pending' row the buyer can't do anything with
    res.status(502).json({ error: "Couldn't start the PayPal payment. Please try again in a moment." });
  }
});

router.post("/orders/:id/capture", async (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status !== "pending") {
    // Already captured (e.g. the buyer's browser retried) — idempotent no-op response.
    return res.json({ status: order.status });
  }
  if (!order.paypal_order_id) return res.status(400).json({ error: "This order was never started with PayPal." });

  let capture;
  try {
    capture = await paypal.captureOrder(order.paypal_order_id);
  } catch (err) {
    console.error("PayPal capture error:", err.message);
    return res.status(502).json({ error: "PayPal couldn't complete this payment. Please try again." });
  }
  if (capture.captureStatus !== "COMPLETED") {
    return res.status(402).json({ error: "Payment was not completed." });
  }

  db.prepare("UPDATE orders SET paypal_capture_id = ?, status = 'paid' WHERE id = ?").run(
    capture.captureId,
    order.id
  );

  // Fulfil the sale: one fewer available, and mark sold out entirely once
  // the last unit goes so it drops off the public listings (see the
  // status = 'active' filter in listings.js's GET /parts).
  const part = db.prepare("SELECT * FROM parts WHERE id = ?").get(order.part_id);
  if (part) {
    const remaining = Math.max(0, (part.quantity || 0) - 1);
    db.prepare("UPDATE parts SET quantity = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(
      remaining,
      remaining > 0 ? part.status : "sold",
      part.id
    );
  }

  let finalStatus = "paid";
  if (order.seller_payout > 0) {
    const seller = order.seller_id ? db.prepare("SELECT paypal_email FROM users WHERE id = ?").get(order.seller_id) : null;
    if (!seller || !seller.paypal_email) {
      console.error(`Order ${order.id}: seller ${order.seller_id} has no PayPal email on file — cannot pay out.`);
      finalStatus = "payout_failed";
    } else {
      try {
        const payout = await paypal.sendPayout({
          receiverEmail: seller.paypal_email,
          amount: order.seller_payout,
          currency: CURRENCY,
          note: `Payout for "${order.part_title}" sold on afcaauto.ca (order #${order.id})`,
          senderBatchId: `afca-order-${order.id}`,
          senderItemId: `order-${order.id}`,
        });
        db.prepare("UPDATE orders SET payout_batch_id = ? WHERE id = ?").run(payout.batchId, order.id);
      } catch (err) {
        // The buyer's payment already succeeded and is final — a payout
        // hiccup must never look like a failed sale to the buyer. It just
        // needs admin attention (Admin panel → Orders → Retry payout).
        console.error(`Order ${order.id}: payout to seller failed:`, err.message);
        finalStatus = "payout_failed";
      }
    }
  }
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(finalStatus, order.id);

  res.json({ status: finalStatus, order_id: order.id });
});

// Minimal public read for a confirmation screen (e.g. after a page
// refresh) — deliberately leaves out PayPal ids and the seller's payout
// email/amount, which aren't the buyer's business.
router.get("/orders/:id", (req, res) => {
  const order = db
    .prepare(
      `SELECT id, part_id, part_title, part_price, fulfillment_method, shipping_fee, total_amount,
              buyer_name, buyer_email, status, created_at
       FROM orders WHERE id = ?`
    )
    .get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order });
});

module.exports = router;
