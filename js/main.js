// App entry: shell, hash router, theme.
import * as store from "./store.js";
import { html, $ } from "./utils.js";
import { icon } from "./ui.js";
import * as register from "./views/register.js";
import * as orders from "./views/orders.js";
import * as products from "./views/products.js";
import * as categories from "./views/categories.js";
import * as dashboard from "./views/dashboard.js";
import * as settings from "./views/settings.js";

// To add a screen: create js/views/<name>.js exporting { title, mount(root) → cleanup } and list it here.
const ROUTES = [
  { path: "register", icon: "point_of_sale", view: register },
  { path: "orders", icon: "receipt_long", view: orders },
  { path: "products", icon: "inventory_2", view: products },
  { path: "categories", icon: "category", view: categories },
  { path: "dashboard", icon: "monitoring", view: dashboard },
  { path: "settings", icon: "settings", view: settings },
];
const DEFAULT_ROUTE = "register";

const outlet = $("#view");
let unmount = null;

function renderNav(active) {
  const s = store.getSettings();
  $("#nav").innerHTML = String(html`
    <a class="brand" href="#/register" aria-label="${s.storeName} home">
      <img src="image/LOGO/Frame 2.png" alt="" width="40" height="40" />
      <span>${s.storeName}<small>Point of Sale</small></span>
    </a>
    <nav class="nav-links">
      ${ROUTES.map((r) => html`
        <a href="#/${r.path}" class="${r.path === active ? "active" : ""}" ${r.path === active ? html`aria-current="page"` : ""}>
          ${icon(r.icon)}<span>${r.view.title}</span>
        </a>`)}
    </nav>
    <div class="nav-foot">
      <button class="btn-icon" data-theme-toggle aria-label="Toggle theme">${icon(isDark() ? "light_mode" : "dark_mode")}</button>
      <span class="cashier">${icon("badge")}<span>${s.cashier}</span></span>
    </div>
  `);
}

function currentPath() {
  const path = location.hash.replace(/^#\/?/, "");
  return ROUTES.some((r) => r.path === path) ? path : DEFAULT_ROUTE;
}

function route() {
  const path = currentPath();
  const { view } = ROUTES.find((r) => r.path === path);
  unmount?.();
  document.querySelectorAll("dialog[open]").forEach((d) => d.remove());
  outlet.innerHTML = "";
  outlet.dataset.view = path;
  unmount = view.mount(outlet) || null;
  document.title = `${view.title} · ${store.getSettings().storeName}`;
  renderNav(path);
}

// ---------------------------------------------------------------- theme
const media = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () => document.documentElement.dataset.theme === "dark";

function applyTheme() {
  const pref = store.getSettings().theme;
  document.documentElement.dataset.theme = pref === "system" ? (media.matches ? "dark" : "light") : pref;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-theme-toggle]")) return;
  store.updateSettings({ theme: isDark() ? "light" : "dark" });
});
media.addEventListener("change", () => {
  applyTheme();
  renderNav(currentPath());
});

store.subscribe((change) => {
  if (change === "settings" || change === "all") {
    applyTheme();
    renderNav(currentPath());
  }
});

window.addEventListener("hashchange", route);
applyTheme();
route();
