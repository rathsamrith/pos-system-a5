// Sales dashboard: KPIs, revenue trend, top products, payment mix, stock alerts.
import * as store from "../store.js";
import { html, on, formatMoney, formatNumber, formatTime, startOfDay, addDays } from "../utils.js";
import { icon, emptyState } from "../ui.js";
import { columnChart, barList, shareBar, attachTooltip } from "../components/charts.js";
import { PAYMENT_LABELS } from "../components/receipt.js";

export const title = "Dashboard";

const RANGES = { today: "Today", "7d": "7 days", "30d": "30 days" };
const RANGE_DAYS = { today: 1, "7d": 7, "30d": 30 };

export function mount(root) {
  let range = "7d";
  const money = (c) => formatMoney(c, store.getSettings().currencySymbol);

  root.innerHTML = String(html`
    <div class="page dashboard">
      <header class="page-head">
        <div><h1>Dashboard</h1><p class="muted" data-summary></p></div>
        <div class="segmented" role="radiogroup" aria-label="Date range">
          ${Object.entries(RANGES).map(([k, v]) => html`<label><input type="radio" name="range" value="${k}" ${k === range ? "checked" : ""} /><span>${v}</span></label>`)}
        </div>
      </header>
      <div data-body></div>
    </div>
  `);
  const page = root.querySelector(".dashboard");
  const body = root.querySelector("[data-body]");
  attachTooltip(page);

  function period(offset = 0) {
    const days = RANGE_DAYS[range];
    const end = addDays(startOfDay(), 1 - days * offset);
    const start = addDays(end, -days);
    return { start, end };
  }

  const inPeriod = (orders, { start, end }) => {
    const s = start.toISOString(), e = end.toISOString();
    return orders.filter((o) => o.status === "paid" && o.createdAt >= s && o.createdAt < e);
  };

  function kpis(orders) {
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const items = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
    const profit = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + (i.price - (i.cost || 0)) * i.qty, 0) - o.discount, 0);
    return { revenue, count: orders.length, avg: orders.length ? Math.round(revenue / orders.length) : 0, items, profit };
  }

  function delta(now, prev) {
    if (!prev) return html`<span class="delta muted">No prior data</span>`;
    const pct = Math.round(((now - prev) / prev) * 100);
    const up = pct >= 0;
    return html`<span class="delta ${up ? "up" : "down"}">${icon(up ? "trending_up" : "trending_down")}${up ? "+" : ""}${pct}%
      <span class="muted">vs previous ${range === "today" ? "day" : "period"}</span></span>`;
  }

  function trendSeries(orders) {
    if (range === "today") {
      const buckets = Array.from({ length: 15 }, (_, i) => ({ hour: 7 + i, value: 0, count: 0 }));
      for (const o of orders) {
        const b = buckets.find((x) => x.hour === new Date(o.createdAt).getHours());
        if (b) { b.value += o.total; b.count++; }
      }
      return buckets.map((b) => ({ label: `${b.hour}h`, value: b.value, tip: `${b.hour}:00 · ${money(b.value)} · ${b.count} orders` }));
    }
    const { start } = period();
    return Array.from({ length: RANGE_DAYS[range] }, (_, i) => {
      const day = addDays(start, i);
      const next = addDays(day, 1);
      const dayOrders = orders.filter((o) => new Date(o.createdAt) >= day && new Date(o.createdAt) < next);
      const value = dayOrders.reduce((s, o) => s + o.total, 0);
      const label = range === "7d" ? day.toLocaleDateString("en-GB", { weekday: "short" }) : day.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { label, value, tip: `${day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${money(value)} · ${dayOrders.length} orders` };
    });
  }

  function render() {
    const all = store.getOrders();
    const current = inPeriod(all, period(0));
    const previous = inPeriod(all, period(1));
    const k = kpis(current);
    const p = kpis(previous);
    root.querySelector("[data-summary]").textContent = `${store.getSettings().storeName} · ${RANGES[range].toLowerCase()}`;

    if (all.length === 0) {
      body.innerHTML = String(emptyState("insights", "No sales yet", "Ring up a sale on the register to see stats here.",
        html`<a class="btn btn-primary" href="#/register">${icon("point_of_sale")}Open register</a>`));
      return;
    }

    // Top products by revenue
    const byProduct = new Map();
    for (const o of current) for (const i of o.items) {
      const row = byProduct.get(i.productId) || { name: `${i.emoji || ""} ${i.name}`.trim(), revenue: 0, qty: 0 };
      row.revenue += i.price * i.qty;
      row.qty += i.qty;
      byProduct.set(i.productId, row);
    }
    const top = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    // Payment mix (fixed series order: cash, card, qr)
    const mix = Object.keys(PAYMENT_LABELS).map((m) => {
      const value = current.filter((o) => o.payment.method === m).reduce((s, o) => s + o.total, 0);
      return { label: PAYMENT_LABELS[m], value, display: money(value) };
    });

    const lowStock = store.getProducts().filter((x) => x.active && x.stock <= x.lowStockAt).sort((a, b) => a.stock - b.stock);
    const recent = all.slice(-6).reverse();
    const series = trendSeries(current);

    body.innerHTML = String(html`
      <section class="kpi-row">
        <article class="card kpi"><span class="kpi-label">Net sales</span><strong class="kpi-value">${money(k.revenue)}</strong>${delta(k.revenue, p.revenue)}</article>
        <article class="card kpi"><span class="kpi-label">Orders</span><strong class="kpi-value">${formatNumber(k.count)}</strong>${delta(k.count, p.count)}</article>
        <article class="card kpi"><span class="kpi-label">Average ticket</span><strong class="kpi-value">${money(k.avg)}</strong>${delta(k.avg, p.avg)}</article>
        <article class="card kpi"><span class="kpi-label">Gross profit</span><strong class="kpi-value">${money(k.profit)}</strong>${delta(k.profit, p.profit)}</article>
      </section>

      <section class="dash-grid">
        <article class="card panel span-2">
          <header class="panel-head"><h2>Net sales by ${range === "today" ? "hour" : "day"}</h2></header>
          <div class="chart-box" data-chart></div>
          <details class="table-toggle">
            <summary>View as table</summary>
            <table class="table compact"><tbody>
              ${series.map((d) => html`<tr><td>${d.label}</td><td class="num">${money(d.value)}</td></tr>`)}
            </tbody></table>
          </details>
        </article>

        <article class="card panel">
          <header class="panel-head"><h2>Top products</h2><span class="muted">by revenue</span></header>
          ${top.length
            ? barList(top.map((t) => ({ label: t.name, value: t.revenue, display: money(t.revenue), tip: `${t.name}: ${money(t.revenue)} · ${t.qty} sold` })))
            : html`<p class="muted">No sales in this period.</p>`}
        </article>

        <article class="card panel">
          <header class="panel-head"><h2>Payment mix</h2></header>
          ${shareBar(mix)}
          <div class="mini-stats">
            <span><strong>${formatNumber(k.items)}</strong> items sold</span>
            <span><strong>${k.count ? (k.items / k.count).toFixed(1) : 0}</strong> items / order</span>
          </div>
        </article>

        <article class="card panel">
          <header class="panel-head"><h2>Low stock</h2><a class="link" href="#/products">Manage</a></header>
          ${lowStock.length
            ? html`<ul class="list">${lowStock.slice(0, 6).map((x) => html`
                <li><span>${x.emoji} ${x.name}</span>
                  ${x.stock === 0
                    ? html`<span class="badge badge-critical">${icon("error")}Out</span>`
                    : html`<span class="badge badge-warning">${icon("warning")}${x.stock} left</span>`}</li>`)}</ul>`
            : html`<p class="muted">${icon("check_circle")} Everything is well stocked.</p>`}
        </article>

        <article class="card panel">
          <header class="panel-head"><h2>Recent orders</h2><a class="link" href="#/orders">View all</a></header>
          <ul class="list">${recent.map((o) => html`
            <li><span><span class="mono">${o.number}</span> <span class="muted">${formatTime(o.createdAt)}</span></span>
              <strong class="${o.status === "refunded" ? "strike" : ""}">${money(o.total)}</strong></li>`)}</ul>
        </article>
      </section>
    `);
    drawChart(series);
  }

  function drawChart(series) {
    const box = body.querySelector("[data-chart]");
    if (!box) return;
    const width = box.clientWidth;
    box.innerHTML = String(columnChart({
      data: series,
      width,
      height: 240,
      format: (v) => formatMoney(v, store.getSettings().currencySymbol).replace(".00", ""),
      labelEvery: range === "30d" ? (width < 600 ? 7 : 3) : range === "today" && width < 500 ? 2 : 1,
    }));
  }

  render();

  let lastWidth = 0;
  const ro = new ResizeObserver(() => {
    const box = body.querySelector("[data-chart]");
    if (box && Math.abs(box.clientWidth - lastWidth) > 4) {
      lastWidth = box.clientWidth;
      drawChart(trendSeries(inPeriod(store.getOrders(), period(0))));
    }
  });
  ro.observe(body);

  const offs = [
    store.subscribe(render),
    on(root, "change", '[name="range"]', (_, el) => {
      range = el.value;
      render();
    }),
  ];
  return () => {
    offs.forEach((off) => off());
    ro.disconnect();
  };
}
