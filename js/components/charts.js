// Tiny dependency-free chart helpers (SVG/HTML strings + a shared hover tooltip).
// Colors come from CSS tokens (--series-*, --grid, --axis) so light/dark just work.
import { html, raw, escapeHtml } from "../utils.js";

/** Round an axis maximum up to a clean 1/2/5 × 10ⁿ step. */
function niceScale(max, ticks = 4) {
  if (max <= 0) return { max: 1, step: 0.25 };
  const rough = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough);
  return { max: step * Math.ceil(max / step), step };
}

/**
 * Single-series column chart.
 * data: [{ label, value, tip }]   format: value → axis label string
 */
export function columnChart({ data, width, height = 240, format = String, labelEvery = 1 }) {
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const w = Math.max(width - pad.left - pad.right, 50);
  const h = height - pad.top - pad.bottom;
  const { max, step } = niceScale(Math.max(...data.map((d) => d.value), 0));
  const band = w / data.length;
  const barW = Math.min(24, band * 0.62);
  const y = (v) => pad.top + h - (v / max) * h;

  const grid = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    grid.push(`<line x1="${pad.left}" x2="${pad.left + w}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? "axis" : "grid"}"/>
      <text x="${pad.left - 8}" y="${y(v)}" class="tick" text-anchor="end" dominant-baseline="middle">${escapeHtml(format(v))}</text>`);
  }

  const bars = data.map((d, i) => {
    const x = pad.left + band * i + (band - barW) / 2;
    const top = y(d.value);
    const bh = pad.top + h - top;
    const r = Math.min(4, bh, barW / 2);
    // Rounded data-end, square at the baseline.
    const path = bh > 0
      ? `<path class="bar" d="M${x},${pad.top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + h} Z"/>`
      : "";
    const label = i % labelEvery === 0
      ? `<text x="${x + barW / 2}" y="${height - 8}" class="tick" text-anchor="middle">${escapeHtml(d.label)}</text>`
      : "";
    const hit = `<rect class="hit" x="${pad.left + band * i}" y="${pad.top}" width="${band}" height="${h}" data-tip="${escapeHtml(d.tip)}"/>`;
    return `<g class="col">${path}${label}${hit}</g>`;
  });

  return raw(`<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
    ${grid.join("")}${bars.join("")}</svg>`);
}

/** Single-series horizontal bars (HTML). rows: [{ label, value, display, tip }] */
export function barList(rows) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return html`
    <ul class="bar-list">
      ${rows.map((r) => html`
        <li data-tip="${r.tip}">
          <span class="bar-label">${r.label}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(r.value / max) * 100}%"></span></span>
          <span class="bar-value">${r.display}</span>
        </li>`)}
    </ul>`;
}

/** 100% stacked bar with legend. parts: [{ label, value, display }] in fixed series order. */
export function shareBar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return html`
    <div class="share-bar" role="img" aria-label="${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}">
      ${parts.map((p, i) => p.value > 0 && html`<span class="share-seg" style="flex:${p.value};background:var(--series-${i + 1})"
        data-tip="${p.label}: ${p.display} (${Math.round((p.value / total) * 100)}%)"></span>`)}
    </div>
    <ul class="legend">
      ${parts.map((p, i) => html`
        <li><span class="swatch" style="background:var(--series-${i + 1})"></span>${p.label}
          <strong>${Math.round((p.value / total) * 100)}%</strong><span class="muted">${p.display}</span></li>`)}
    </ul>`;
}

/** Attach one floating tooltip to a container; any descendant with data-tip triggers it. */
export function attachTooltip(container) {
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  container.appendChild(tip);

  const move = (e) => {
    const target = e.target.closest("[data-tip]");
    if (!target || !container.contains(target)) {
      tip.hidden = true;
      container.querySelectorAll(".hover").forEach((el) => el.classList.remove("hover"));
      return;
    }
    container.querySelectorAll(".hover").forEach((el) => el !== target && el.classList.remove("hover"));
    (target.closest(".col") || target).classList.add("hover");
    tip.textContent = target.dataset.tip;
    tip.hidden = false;
    const box = container.getBoundingClientRect();
    const x = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.transform = `translate(${Math.max(4, x)}px, ${e.clientY - box.top - tip.offsetHeight - 10}px)`;
  };
  const leave = () => {
    tip.hidden = true;
    container.querySelectorAll(".hover").forEach((el) => el.classList.remove("hover"));
  };
  container.addEventListener("mousemove", move);
  container.addEventListener("mouseleave", leave);
}
