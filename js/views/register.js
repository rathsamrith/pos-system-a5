// Register / point-of-sale screen: catalog on the left, current sale on the right.
import * as store from "../store.js";
import { html, on, formatMoney, formatRiel, toCents, fromCents } from "../utils.js";
import { icon, openModal, toast, confirmDialog, emptyState } from "../ui.js";
import { renderReceipt, PAYMENT_LABELS } from "../components/receipt.js";

export const title = "Register";

export function mount(root) {
  let activeCategory = "all";
  let query = "";

  root.innerHTML = String(html`
    <div class="register">
      <section class="catalog">
        <div class="catalog-toolbar">
          <label class="search-field">
            ${icon("search")}
            <input id="reg-search" type="search" autocomplete="off"
              placeholder="Search products or scan SKU…" aria-label="Search products or scan SKU" />
            <kbd>/</kbd>
          </label>
        </div>
        <div class="chips" data-chips></div>
        <div class="product-grid" data-grid></div>
      </section>
      <aside class="cart-panel" data-cart aria-label="Current sale"></aside>
      <button class="cart-fab" data-action="toggle-cart"></button>
    </div>
  `);

  const search = root.querySelector("#reg-search");
  const chipsEl = root.querySelector("[data-chips]");
  const gridEl = root.querySelector("[data-grid]");
  const cartEl = root.querySelector("[data-cart]");
  const fabEl = root.querySelector(".cart-fab");
  const money = (c) => formatMoney(c, store.getSettings().currencySymbol);

  // ------------------------------------------------------------ rendering
  function visibleProducts() {
    const q = query.trim().toLowerCase();
    return store
      .getProducts()
      .filter((p) => p.active)
      .filter((p) => activeCategory === "all" || p.categoryId === activeCategory)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderChips() {
    const cats = store.getCategories();
    chipsEl.innerHTML = String(html`
      <button class="chip ${activeCategory === "all" ? "active" : ""}" data-cat="all">All</button>
      ${cats.map(
        (c) => html`<button class="chip ${activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">
          <span class="dot" style="background:${c.color}"></span>${c.name}
        </button>`
      )}
    `);
  }

  function renderGrid() {
    const products = visibleProducts();
    if (products.length === 0) {
      gridEl.innerHTML = String(
        store.getProducts().length === 0
          ? emptyState("inventory_2", "No products yet", "Add products to start selling.",
              html`<a class="btn btn-primary" href="#/products">${icon("add")}Add products</a>`)
          : emptyState("search_off", "No matching products", "Try another search or category.")
      );
      return;
    }
    gridEl.innerHTML = String(html`${products.map((p) => {
      const inCart = store.cartQtyFor(p.id);
      const left = p.stock - inCart;
      const cat = store.getCategory(p.categoryId);
      const stockClass = p.stock === 0 ? "out" : p.stock <= p.lowStockAt ? "low" : "";
      return html`
        <button class="product-tile ${stockClass}" data-add="${p.id}" ${left <= 0 ? "disabled" : ""}
          aria-label="Add ${p.name}, ${money(p.price)}">
          ${inCart > 0 && html`<span class="tile-qty">${inCart}</span>`}
          <span class="tile-emoji" style="--cat:${cat?.color || "var(--muted)"}">${p.emoji || "📦"}</span>
          <span class="tile-name">${p.name}</span>
          <span class="tile-foot">
            <strong>${money(p.price)}</strong>
            <span class="tile-stock">${p.stock === 0 ? "Out of stock" : `${left} left`}</span>
          </span>
        </button>`;
    })}`);
  }

  function renderCart() {
    const lines = store.getCartLines();
    const cart = store.getCart();
    const totals = store.getCartTotals();
    const s = store.getSettings();

    cartEl.innerHTML = String(html`
      <header class="cart-head">
        <div>
          <h2>Current sale</h2>
          <span class="muted">${totals.itemCount} item${totals.itemCount === 1 ? "" : "s"}</span>
        </div>
        <div class="cart-head-actions">
          <button class="btn-icon cart-close" data-action="toggle-cart" aria-label="Close cart">${icon("close")}</button>
          <button class="btn btn-ghost btn-sm" data-action="clear" ${lines.length ? "" : "disabled"}>
            ${icon("delete_sweep")}Clear
          </button>
        </div>
      </header>

      <label class="customer-field">
        ${icon("person")}
        <input data-customer type="text" placeholder="Customer name or phone (optional)" value="${cart.customer}" />
      </label>

      <div class="cart-lines">
        ${lines.length === 0
          ? emptyState("shopping_cart", "Cart is empty", "Tap a product or scan a SKU to add it.")
          : lines.map((l) => html`
              <div class="cart-line">
                <span class="line-emoji">${l.product.emoji || "📦"}</span>
                <div class="line-info">
                  <span class="line-name">${l.product.name}</span>
                  <span class="muted">${money(l.product.price)} each</span>
                </div>
                <div class="stepper">
                  <button data-qty="${l.product.id}" data-delta="-1" aria-label="Decrease">${icon("remove")}</button>
                  <input data-qty-input="${l.product.id}" type="number" min="0" max="${l.product.stock}"
                    value="${l.qty}" aria-label="Quantity of ${l.product.name}" />
                  <button data-qty="${l.product.id}" data-delta="1" aria-label="Increase"
                    ${l.qty >= l.product.stock ? "disabled" : ""}>${icon("add")}</button>
                </div>
                <strong class="line-total">${money(l.product.price * l.qty)}</strong>
              </div>`)}
      </div>

      <div class="cart-summary">
        <div class="row"><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>
        <div class="row">
          <button class="link" data-action="discount" ${lines.length ? "" : "disabled"}>
            ${icon("sell")}${totals.discount > 0
              ? `Discount (${cart.discount.type === "percent" ? `${cart.discount.value}%` : "fixed"})`
              : "Add discount"}
          </button>
          <span>${totals.discount > 0 ? `−${money(totals.discount)}` : "—"}</span>
        </div>
        <div class="row"><span>VAT ${s.taxRate}%</span><span>${money(totals.tax)}</span></div>
        <div class="row total"><span>Total</span><span>${money(totals.total)}</span></div>
        ${s.showRiel && html`<div class="row riel"><span></span><span>${formatRiel(totals.total, s.rielRate)}</span></div>`}
        <button class="btn btn-primary btn-lg btn-block" data-action="charge" ${lines.length ? "" : "disabled"}>
          ${icon("payments")}Charge ${money(totals.total)}
        </button>
      </div>
    `);

    fabEl.innerHTML = String(html`${icon("shopping_cart")}<span>${totals.itemCount} · ${money(totals.total)}</span>`);
    fabEl.hidden = totals.itemCount === 0;
  }

  const renderAll = () => {
    renderChips();
    renderGrid();
    renderCart();
  };
  renderAll();

  // --------------------------------------------------------------- events
  const offs = [
    store.subscribe(renderAll),

    on(chipsEl, "click", "[data-cat]", (_, el) => {
      activeCategory = el.dataset.cat;
      renderChips();
      renderGrid();
    }),

    on(gridEl, "click", "[data-add]", (_, el) => {
      if (!store.addToCart(el.dataset.add)) toast("Not enough stock", "error");
    }),

    on(cartEl, "click", "[data-qty]", (_, el) => {
      const id = el.dataset.qty;
      store.setCartQty(id, store.cartQtyFor(id) + Number(el.dataset.delta));
    }),

    on(cartEl, "change", "[data-qty-input]", (_, el) => {
      const ok = store.setCartQty(el.dataset.qtyInput, Math.floor(Number(el.value) || 0));
      if (!ok) toast("Quantity limited to available stock", "error");
    }),

    on(cartEl, "change", "[data-customer]", (_, el) => store.setCartCustomer(el.value)),
    on(cartEl, "click", '[data-action="clear"]', async () => {
      if (await confirmDialog({ title: "Clear sale?", message: "Remove all items from the current sale.", confirmLabel: "Clear", danger: true }))
        store.clearCart();
    }),
    on(cartEl, "click", '[data-action="discount"]', openDiscount),
    on(cartEl, "click", '[data-action="charge"]', openPayment),
    on(root, "click", '[data-action="toggle-cart"]', () => root.querySelector(".register").classList.toggle("cart-open")),
  ];

  search.addEventListener("input", () => {
    query = search.value;
    renderGrid();
  });

  // Enter = scan: exact SKU match, or the only search result, goes straight to the cart.
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const exact = store.findProductBySku(search.value);
    const results = visibleProducts();
    const target = exact || (results.length === 1 ? results[0] : null);
    if (!target) return;
    if (store.addToCart(target.id)) toast(`Added ${target.name}`, "success");
    else toast(`${target.name} is out of stock`, "error");
    search.value = query = "";
    renderGrid();
  });

  const onKey = (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (e.key === "/" && !typing && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      search.focus();
    }
  };
  document.addEventListener("keydown", onKey);
  search.focus();

  return () => {
    offs.forEach((off) => off());
    document.removeEventListener("keydown", onKey);
  };
}

// ---------------------------------------------------------------- modals
function openDiscount() {
  const current = store.getCart().discount;
  openModal({
    title: "Discount",
    size: "sm",
    render(body, close) {
      body.innerHTML = String(html`
        <form class="form" data-form>
          <div class="segmented" role="radiogroup">
            <label><input type="radio" name="type" value="percent" ${current.type === "percent" ? "checked" : ""} /><span>Percent %</span></label>
            <label><input type="radio" name="type" value="amount" ${current.type === "amount" ? "checked" : ""} /><span>Amount ${store.getSettings().currencySymbol}</span></label>
          </div>
          <label class="field">
            <span>Value</span>
            <input name="value" type="number" min="0" step="0.01" value="${current.value || ""}" required autofocus />
          </label>
          <div class="quick-row">
            ${[5, 10, 15, 20].map((v) => html`<button type="button" class="btn btn-ghost btn-sm" data-pct="${v}">${v}%</button>`)}
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-remove>Remove discount</button>
            <button class="btn btn-primary">Apply</button>
          </div>
        </form>
      `);
      const form = body.querySelector("form");
      on(body, "click", "[data-pct]", (_, el) => {
        store.setCartDiscount({ type: "percent", value: Number(el.dataset.pct) });
        close();
      });
      body.querySelector("[data-remove]").addEventListener("click", () => {
        store.setCartDiscount({ type: "percent", value: 0 });
        close();
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = new FormData(form);
        store.setCartDiscount({ type: data.get("type"), value: Math.max(0, Number(data.get("value")) || 0) });
        close();
      });
    },
  });
}

function openPayment() {
  const totals = store.getCartTotals();
  const s = store.getSettings();
  const money = (c) => formatMoney(c, s.currencySymbol);
  let method = "cash";

  // Quick-cash suggestions: exact, then the next round notes above the total.
  const quick = [...new Set([totals.total, ...[100, 500, 1000, 2000, 5000, 10000].map((n) => Math.ceil(totals.total / n) * n)])]
    .filter((c) => c >= totals.total)
    .slice(0, 5);

  openModal({
    title: "Payment",
    render(body, close) {
      body.innerHTML = String(html`
        <div class="pay-total">
          <span class="muted">Amount due</span>
          <strong>${money(totals.total)}</strong>
          ${s.showRiel && html`<span class="muted">${formatRiel(totals.total, s.rielRate)}</span>`}
        </div>
        <div class="segmented pay-methods" role="radiogroup">
          ${Object.entries(PAYMENT_LABELS).map(([key, label]) => html`
            <label><input type="radio" name="method" value="${key}" ${key === method ? "checked" : ""} />
              <span>${icon({ cash: "payments", card: "credit_card", qr: "qr_code_2" }[key])}${label}</span></label>`)}
        </div>
        <div data-method-body></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary btn-lg" data-complete>${icon("check")}Complete sale</button>
        </div>
      `);
      const methodBody = body.querySelector("[data-method-body]");
      const completeBtn = body.querySelector("[data-complete]");

      const renderMethod = () => {
        if (method === "cash") {
          methodBody.innerHTML = String(html`
            <label class="field">
              <span>Cash received</span>
              <input data-tendered type="number" min="0" step="0.01" value="${fromCents(totals.total)}" />
            </label>
            <div class="quick-row">
              ${quick.map((c) => html`<button type="button" class="btn btn-ghost btn-sm" data-cash="${c}">
                ${c === totals.total ? "Exact" : money(c)}</button>`)}
            </div>
            <div class="change-due"><span>Change due</span><strong data-change></strong></div>
          `);
          const input = methodBody.querySelector("[data-tendered]");
          const update = () => {
            const change = toCents(input.value) - totals.total;
            methodBody.querySelector("[data-change]").textContent = change >= 0 ? money(change) : `${money(-change)} short`;
            methodBody.querySelector(".change-due").classList.toggle("short", change < 0);
            completeBtn.disabled = change < 0;
          };
          input.addEventListener("input", update);
          on(methodBody, "click", "[data-cash]", (_, el) => {
            input.value = fromCents(Number(el.dataset.cash));
            update();
          });
          update();
          input.select();
        } else {
          completeBtn.disabled = false;
          methodBody.innerHTML = String(method === "qr"
            ? html`<div class="pay-placeholder">${icon("qr_code_2", "big")}<p>Show the customer the store QR code.<br /><span class="muted">Mock: no payment gateway is connected.</span></p></div>`
            : html`<div class="pay-placeholder">${icon("contactless", "big")}<p>Tap, insert or swipe the card on the terminal.<br /><span class="muted">Mock: no card terminal is connected.</span></p></div>`);
        }
      };
      renderMethod();

      on(body, "change", '[name="method"]', (_, el) => {
        method = el.value;
        renderMethod();
      });

      completeBtn.addEventListener("click", () => {
        try {
          const tendered = method === "cash" ? toCents(body.querySelector("[data-tendered]").value) : totals.total;
          const order = store.checkout({ method, tendered });
          close();
          showReceipt(order);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    },
  });
}

export function showReceipt(order, { title = "Sale complete" } = {}) {
  openModal({
    title,
    size: "sm",
    render(body) {
      body.innerHTML = String(html`
        ${renderReceipt(order)}
        <div class="modal-actions">
          <button class="btn btn-ghost" data-print>${icon("print")}Print</button>
          <button class="btn btn-primary" data-close>${icon("add_shopping_cart")}New sale</button>
        </div>
      `);
      body.querySelector("[data-print]").addEventListener("click", () => window.print());
    },
  });
}
