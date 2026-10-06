// Product catalog management: list, filter, add/edit, delete.
import * as store from "../store.js";
import { html, on, formatMoney, toCents, fromCents } from "../utils.js";
import { icon, openModal, toast, confirmDialog, emptyState } from "../ui.js";

export const title = "Products";

export function mount(root) {
  const filters = { q: "", category: "all", stock: "all" };
  const money = (c) => formatMoney(c, store.getSettings().currencySymbol);

  root.innerHTML = String(html`
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Products</h1>
          <p class="muted" data-summary></p>
        </div>
        <button class="btn btn-primary" data-action="new">${icon("add")}New product</button>
      </header>
      <div class="toolbar">
        <label class="search-field">${icon("search")}<input data-q type="search" placeholder="Search name or SKU" aria-label="Search products" /></label>
        <select data-category aria-label="Filter by category"></select>
        <select data-stock aria-label="Filter by stock">
          <option value="all">All stock levels</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="inactive">Hidden from register</option>
        </select>
      </div>
      <div class="card table-wrap" data-table></div>
    </div>
  `);

  const tableEl = root.querySelector("[data-table]");
  const categorySelect = root.querySelector("[data-category]");

  function renderCategoryOptions() {
    categorySelect.innerHTML = String(html`
      <option value="all">All categories</option>
      ${store.getCategories().map((c) => html`<option value="${c.id}" ${filters.category === c.id ? "selected" : ""}>${c.name}</option>`)}
    `);
  }

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    return store
      .getProducts()
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .filter((p) => filters.category === "all" || p.categoryId === filters.category)
      .filter((p) => {
        if (filters.stock === "low") return p.stock > 0 && p.stock <= p.lowStockAt;
        if (filters.stock === "out") return p.stock === 0;
        if (filters.stock === "inactive") return !p.active;
        return true;
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  function render() {
    const all = store.getProducts();
    const rows = filtered();
    const low = all.filter((p) => p.stock <= p.lowStockAt).length;
    root.querySelector("[data-summary]").textContent =
      `${all.length} products · ${low} need restocking`;

    if (rows.length === 0) {
      tableEl.innerHTML = String(all.length === 0
        ? emptyState("inventory_2", "No products yet", "Create your first product to start selling.")
        : emptyState("search_off", "Nothing matches these filters"));
      return;
    }
    tableEl.innerHTML = String(html`
      <table class="table">
        <thead>
          <tr>
            <th>Product</th><th>SKU</th><th>Category</th>
            <th class="num">Price</th><th class="num">Margin</th><th class="num">Stock</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((p) => {
            const cat = store.getCategory(p.categoryId);
            const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
            return html`
              <tr class="${p.active ? "" : "inactive"}">
                <td><span class="cell-product"><span class="emoji">${p.emoji || "📦"}</span>${p.name}
                  ${!p.active && html`<span class="badge">Hidden</span>`}</span></td>
                <td class="mono">${p.sku}</td>
                <td>${cat ? html`<span class="dot" style="background:${cat.color}"></span>${cat.name}` : html`<span class="muted">—</span>`}</td>
                <td class="num">${money(p.price)}</td>
                <td class="num muted">${margin}%</td>
                <td class="num">${stockBadge(p)}</td>
                <td class="actions">
                  <button class="btn-icon" data-edit="${p.id}" aria-label="Edit ${p.name}">${icon("edit")}</button>
                  <button class="btn-icon danger" data-delete="${p.id}" aria-label="Delete ${p.name}">${icon("delete")}</button>
                </td>
              </tr>`;
          })}
        </tbody>
      </table>
    `);
  }

  renderCategoryOptions();
  render();

  const offs = [
    store.subscribe(() => {
      renderCategoryOptions();
      render();
    }),
    on(root, "click", '[data-action="new"]', () => openProductForm()),
    on(root, "click", "[data-edit]", (_, el) => openProductForm(store.getProduct(el.dataset.edit))),
    on(root, "click", "[data-delete]", async (_, el) => {
      const p = store.getProduct(el.dataset.delete);
      const ok = await confirmDialog({
        title: `Delete ${p.name}?`,
        message: "Past orders keep their copy of this product. Consider hiding it from the register instead.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (ok) {
        store.deleteProduct(p.id);
        toast("Product deleted", "success");
      }
    }),
  ];
  root.querySelector("[data-q]").addEventListener("input", (e) => ((filters.q = e.target.value), render()));
  categorySelect.addEventListener("change", (e) => ((filters.category = e.target.value), render()));
  root.querySelector("[data-stock]").addEventListener("change", (e) => ((filters.stock = e.target.value), render()));

  return () => offs.forEach((off) => off());
}

function stockBadge(p) {
  if (p.stock === 0) return html`<span class="badge badge-critical">${icon("error")}Out</span>`;
  if (p.stock <= p.lowStockAt) return html`<span class="badge badge-warning">${icon("warning")}${p.stock}</span>`;
  return html`${p.stock}`;
}

function openProductForm(product) {
  const isNew = !product;
  const p = product || { name: "", sku: "", emoji: "", categoryId: store.getCategories()[0]?.id || "", price: 0, cost: 0, stock: 0, lowStockAt: 10, active: true };
  const categories = store.getCategories();

  openModal({
    title: isNew ? "New product" : `Edit ${p.name}`,
    render(body, close) {
      body.innerHTML = String(html`
        <form class="form grid-2">
          <label class="field span-2"><span>Name</span><input name="name" required value="${p.name}" autofocus /></label>
          <label class="field"><span>SKU / barcode</span><input name="sku" required value="${p.sku}" class="mono" /></label>
          <label class="field"><span>Emoji / icon</span><input name="emoji" maxlength="4" value="${p.emoji}" placeholder="📦" /></label>
          <label class="field span-2"><span>Category</span>
            <select name="categoryId" required>
              ${categories.length === 0 && html`<option value="">Create a category first</option>`}
              ${categories.map((c) => html`<option value="${c.id}" ${c.id === p.categoryId ? "selected" : ""}>${c.name}</option>`)}
            </select>
          </label>
          <label class="field"><span>Price</span><input name="price" type="number" min="0" step="0.01" required value="${fromCents(p.price)}" /></label>
          <label class="field"><span>Cost</span><input name="cost" type="number" min="0" step="0.01" value="${fromCents(p.cost)}" /></label>
          <label class="field"><span>Stock on hand</span><input name="stock" type="number" min="0" step="1" required value="${p.stock}" /></label>
          <label class="field"><span>Low-stock alert at</span><input name="lowStockAt" type="number" min="0" step="1" value="${p.lowStockAt}" /></label>
          <label class="check span-2"><input type="checkbox" name="active" ${p.active ? "checked" : ""} /> Show on register</label>
          <div class="modal-actions span-2">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary">${isNew ? "Create product" : "Save changes"}</button>
          </div>
        </form>
      `);
      const form = body.querySelector("form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = new FormData(form);
        try {
          store.saveProduct({
            ...(isNew ? {} : { id: p.id }),
            name: d.get("name").trim(),
            sku: d.get("sku").trim().toUpperCase(),
            emoji: d.get("emoji").trim(),
            categoryId: d.get("categoryId"),
            price: toCents(d.get("price")),
            cost: toCents(d.get("cost")),
            stock: Math.max(0, parseInt(d.get("stock"), 10) || 0),
            lowStockAt: Math.max(0, parseInt(d.get("lowStockAt"), 10) || 0),
            active: d.get("active") === "on",
          });
          toast(isNew ? "Product created" : "Product saved", "success");
          close();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    },
  });
}
