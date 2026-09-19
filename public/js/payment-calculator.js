// payment-calculator.js — a simple, fully client-side loan/payment
// estimator (Soni Motors-style "Payment Calculator" tool). Nothing here
// talks to the server or saves anything — it's just the standard
// amortization formula, recalculated live as the visitor types.

function calcMonthlyPayment({ price, downPayment, tradeIn, apr, termMonths }) {
  const principal = Math.max(0, (price || 0) - (downPayment || 0) - (tradeIn || 0));
  const months = Math.max(1, Math.round(termMonths || 0));
  const monthlyRate = (apr || 0) / 100 / 12;

  let monthly;
  if (monthlyRate === 0) {
    monthly = principal / months;
  } else {
    const factor = Math.pow(1 + monthlyRate, months);
    monthly = (principal * monthlyRate * factor) / (factor - 1);
  }

  const totalPaid = monthly * months;
  const totalInterest = Math.max(0, totalPaid - principal);

  return {
    principal,
    monthly: Number.isFinite(monthly) ? monthly : 0,
    totalPaid: Number.isFinite(totalPaid) ? totalPaid : 0,
    totalInterest: Number.isFinite(totalInterest) ? totalInterest : 0,
  };
}

function fmtMoney(n) {
  return "$" + Number(n || 0).toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

function wirePaymentCalculator(formSelector, resultSelector) {
  const form = qs(formSelector);
  const result = qs(resultSelector);
  if (!form || !result) return;

  function recalc() {
    const values = {
      price: Number(form.elements.price.value) || 0,
      downPayment: Number(form.elements.down_payment.value) || 0,
      tradeIn: Number(form.elements.trade_in.value) || 0,
      apr: Number(form.elements.apr.value) || 0,
      termMonths: Number(form.elements.term.value) || 60,
    };
    const { principal, monthly, totalPaid, totalInterest } = calcMonthlyPayment(values);

    qs("#calc-monthly-value", result).textContent = fmtMoney(monthly);
    qs("#calc-principal", result).textContent = fmtMoney(principal);
    qs("#calc-interest", result).textContent = fmtMoney(totalInterest);
    qs("#calc-total", result).textContent = fmtMoney(totalPaid);
  }

  form.addEventListener("input", recalc);
  form.addEventListener("submit", (e) => e.preventDefault());
  recalc();
}

document.addEventListener("DOMContentLoaded", () => {
  wirePaymentCalculator("#calc-form", "#calc-result");
});
