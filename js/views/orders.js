// Order history: filter, inspect, reprint, refund, export.
import * as store from "../store.js";
import { html, on, formatMoney, formatDate, formatTime, startOfDay, addDays, downloadFile } from "../utils.js";
import { icon, openModal, toast, confirmDialog, emptyState } from "../ui.js";
import { renderReceipt, PAYMENT_LABELS } from "../components/receipt.js";

export const title = "Orders";

const PAGE_SIZE = 50;
const RANGES = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

export function rangeStart(range) {
  const today = startOfDay();
  if (range === "today") return today;
  if (range === "7d") return addDays(today, -6);
  if (range === "30d") return addDays(today, -29);
  return new Date(0);
}

export function mount(root) {
  const filters = { q: "", range: "7d", status: "all", method: "all" };
  let limit = PAGE_SIZE;
  const money = (c) => formatMoney(c, store.getSettings().currencySymbol);

  root.innerHTML = String(html`
    <div class="page">
      <header class="page-head">
        <div><h1>Orders</h1><p class="muted" data-summary></p></div>
        <button class="btn btn-ghost" data-action="export">${icon("download")}Export CSV</button>
      </header>
      <div class="toolbar">
        <label class="search-field">${icon("search")}<input data-q type="search" placeholder="Receipt #, customer or product" aria-label="Search orders" /></label>
        <select data-range aria-label="Date range">
          ${Object.entries(RANGES).map(([k, v]) => html`<option value="${k}" ${k === filters.range ? "selected" : ""}>${v}</option>`)}
        </select>
        <select data-method aria-label="Payment method">
          <option value="all">All payments</option>
          ${Object.entries(PAYMENT_LABELS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}
        </select>
        <select data-status aria-label="Status">
          <option value="all">All statuses</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
        </select>
      </div>
      <div class="card table-wrap" data-table></div>
    </div>
  `);
  const tableEl = root.querySelector("[data-table]");

  function filtered() {
    const from = rangeStart(filters.range).toISOString();
    const q = filters.q.trim().toLowerCase();
    return store
      .getOrders()
      .filter((o) => o.createdAt >= from)
      .filter((o) => filters.status === "all" || o.status === filters.status)
      .filter((o) => filters.method === "all" || o.payment.method === filters.method)
      .filter((o) => !q || o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q)))
      .slice()
      .reverse();
  }

  function render() {
    const rows = filtered();
    const paid = rows.filter((o) => o.status === "paid");
    root.querySelector("[data-summary]").textContent =
      `${rows.length} orders · ${money(paid.reduce((s, o) => s + o.total, 0))} net sales`;

    if (rows.length === 0) {
      tableEl.innerHTML = String(emptyState("receipt_long", "No orders found", "Completed sales from the register show up here."));
      return;
    }
    tableEl.innerHTML = String(html`
      <table class="table table-click">
        <thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th class="num">Items</th><th>Payment</th><th class="num">Total</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.slice(0, limit).map((o) => html`
            <tr data-open="${o.id}" tabindex="0">
              <td class="mono">${o.number}</td>
              <td>${formatDate(o.createdAt)} <span class="muted">${formatTime(o.createdAt)}</span></td>
              <td>${o.customer || html`<span class="muted">Walk-in</span>`}</td>
              <td class="num">${o.items.reduce((n, i) => n + i.qty, 0)}</td>
              <td>${PAYMENT_LABELS[o.payment.method]}</td>
              <td class="num"><strong>${money(o.total)}</strong></td>
              <td>${o.status === "paid"
                ? html`<span class="badge badge-good">${icon("check_circle")}Paid</span>`
                : html`<span class="badge">${icon("undo")}Refunded</span>`}</td>
            </tr>`)}
        </tbody>
      </table>
      ${rows.length > limit && html`<div class="table-more"><button class="btn btn-ghost" data-action="more">Show more (${rows.length - limit} remaining)</button></div>`}
    `);
  }
  render();

  const reset = () => {
    limit = PAGE_SIZE;
    render();
  };
  root.querySelector("[data-q]").addEventListener("input", (e) => ((filters.q = e.target.value), reset()));
  root.querySelector("[data-range]").addEventListener("change", (e) => ((filters.range = e.target.value), reset()));
  root.querySelector("[data-status]").addEventListener("change", (e) => ((filters.status = e.target.value), reset()));
  root.querySelector("[data-method]").addEventListener("change", (e) => ((filters.method = e.target.value), reset()));

  const offs = [
    store.subscribe(render),
    on(root, "click", '[data-action="more"]', () => ((limit += PAGE_SIZE), render())),
    on(root, "click", "[data-open]", (_, el) => openOrder(el.dataset.open)),
    on(root, "keydown", "[data-open]", (e, el) => e.key === "Enter" && openOrder(el.dataset.open)),
    on(root, "click", '[data-action="export"]', () => {
      const rows = filtered();
      const header = ["receipt", "date", "customer", "items", "subtotal", "discount", "tax", "total", "payment", "status"];
      const csv = [header, ...rows.map((o) => [
        o.number, o.createdAt, o.customer, o.items.map((i) => `${i.qty}x ${i.name}`).join("; "),
        o.subtotal / 100, o.discount / 100, o.tax / 100, o.total / 100, o.payment.method, o.status,
      ])].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      downloadFile(`orders-${filters.range}.csv`, csv, "text/csv");
    }),
  ];
  return () => offs.forEach((off) => off());
}

function openOrder(id) {
  const order = store.getOrder(id);
  openModal({
    title: `Order ${order.number}`,
    size: "sm",
    render(body, close) {
      body.innerHTML = String(html`
        ${renderReceipt(order)}
        <div class="modal-actions">
          ${order.status === "paid" && html`<button class="btn btn-ghost danger" data-refund>${icon("undo")}Refund</button>`}
          <button class="btn btn-primary" data-print>${icon("print")}Print</button>
        </div>
      `);
      body.querySelector("[data-print]").addEventListener("click", () => window.print());
      body.querySelector("[data-refund]")?.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Refund ${order.number}?`,
          message: "The order is marked refunded and its items go back into stock.",
          confirmLabel: "Refund",
          danger: true,
        });
        if (!ok) return;
        store.refundOrder(order.id);
        toast(`${order.number} refunded`, "success");
        close();
      });
    },
  });
}
