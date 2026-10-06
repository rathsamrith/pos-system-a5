// Small, dependency-free helpers shared by every view.

// ---------- HTML templating ----------
// `html` is a tagged template that escapes every interpolated value unless it
// is itself the result of `html`/`raw`. Arrays are joined, null/false skipped.
class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value) => new SafeHtml(String(value));

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(renderValue).join("");
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new SafeHtml(out);
}

// ---------- DOM ----------
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Delegated event handling: on(root, "click", "[data-action]", (e, el) => ...) */
export function on(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

// ---------- Ids ----------
export function uid(prefix = "") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

// ---------- Money (all amounts are integer cents) ----------
export const toCents = (value) => Math.round(Number(value || 0) * 100);
export const fromCents = (cents) => (cents / 100).toFixed(2);

export function formatMoney(cents, symbol = "$") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}${symbol}${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRiel(cents, rate) {
  const riel = Math.round(((cents / 100) * rate) / 100) * 100; // riel rounds to 100
  return `៛${riel.toLocaleString("en-US")}`;
}

export const formatNumber = (n) => Number(n).toLocaleString("en-US");

// ---------- Dates ----------
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso) => `${formatDate(iso)} · ${formatTime(iso)}`;

// ---------- Misc ----------
export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Deterministic PRNG so seeded demo data looks the same on every reset. */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function downloadFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
