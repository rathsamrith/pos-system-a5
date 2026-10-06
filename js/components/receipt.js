// Printable receipt, shared by checkout and order history.
import { html, formatMoney, formatRiel, formatDateTime } from "../utils.js";
import { getSettings } from "../store.js";

export const PAYMENT_LABELS = { cash: "Cash", card: "Card", qr: "QR / KHQR" };

export function renderReceipt(order) {
  const s = getSettings();
  const money = (c) => formatMoney(c, s.currencySymbol);
  return html`
    <div class="receipt print-area">
      <div class="receipt-head">
        <img src="image/LOGO/Frame 2.png" alt="" width="56" height="56" />
        <strong>${s.storeName}</strong>
        <span>${s.storeAddress}</span>
        <span>${s.storePhone}</span>
      </div>
      <div class="receipt-meta">
        <span>Receipt</span><span>${order.number}</span>
        <span>Date</span><span>${formatDateTime(order.createdAt)}</span>
        <span>Cashier</span><span>${order.cashier}</span>
        ${order.customer && html`<span>Customer</span><span>${order.customer}</span>`}
      </div>
      ${order.status === "refunded" && html`<div class="receipt-stamp">REFUNDED</div>`}
      <table class="receipt-items">
        <tbody>
          ${order.items.map(
            (i) => html`
              <tr>
                <td>
                  ${i.name}
                  <small>${i.qty} × ${money(i.price)}</small>
                </td>
                <td class="num">${money(i.price * i.qty)}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
      <div class="receipt-totals">
        <span>Subtotal</span><span>${money(order.subtotal)}</span>
        ${order.discount > 0 && html`<span>Discount</span><span>−${money(order.discount)}</span>`}
        <span>VAT ${order.taxRate}%</span><span>${money(order.tax)}</span>
        <strong>Total</strong><strong>${money(order.total)}</strong>
        ${s.showRiel && html`<span></span><span class="muted">${formatRiel(order.total, s.rielRate)}</span>`}
        <span>${PAYMENT_LABELS[order.payment.method]}</span><span>${money(order.payment.tendered)}</span>
        ${order.payment.method === "cash" && html`<span>Change</span><span>${money(order.payment.change)}</span>`}
      </div>
      <p class="receipt-foot">${s.receiptFooter}</p>
    </div>
  `;
}
