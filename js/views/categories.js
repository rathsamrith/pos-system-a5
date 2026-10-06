// Category management.
import * as store from "../store.js";
import { html, on } from "../utils.js";
import { icon, openModal, toast, confirmDialog, emptyState } from "../ui.js";

export const title = "Categories";

// Category swatches reuse the chart palette so colors stay consistent app-wide.
const SWATCHES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export function mount(root) {
  root.innerHTML = String(html`
    <div class="page">
      <header class="page-head">
        <div><h1>Categories</h1><p class="muted" data-summary></p></div>
        <button class="btn btn-primary" data-action="new">${icon("add")}New category</button>
      </header>
      <div class="category-grid" data-list></div>
    </div>
  `);
  const listEl = root.querySelector("[data-list]");

  function render() {
    const cats = store.getCategories();
    const products = store.getProducts();
    root.querySelector("[data-summary]").textContent = `${cats.length} categories`;
    if (cats.length === 0) {
      listEl.innerHTML = String(emptyState("category", "No categories yet", "Categories group products on the register."));
      return;
    }
    listEl.innerHTML = String(html`${cats.map((c) => {
      const items = products.filter((p) => p.categoryId === c.id);
      const units = items.reduce((n, p) => n + p.stock, 0);
      return html`
        <article class="card category-card" style="--cat:${c.color}">
          <div class="category-card-head">
            <span class="swatch"></span>
            <h3>${c.name}</h3>
            <button class="btn-icon" data-edit="${c.id}" aria-label="Edit ${c.name}">${icon("edit")}</button>
            <button class="btn-icon danger" data-delete="${c.id}" aria-label="Delete ${c.name}">${icon("delete")}</button>
          </div>
          <p class="muted">${c.description || "No description"}</p>
          <div class="category-stats">
            <span><strong>${items.length}</strong> products</span>
            <span><strong>${units}</strong> units in stock</span>
          </div>
        </article>`;
    })}`);
  }
  render();

  const offs = [
    store.subscribe(render),
    on(root, "click", '[data-action="new"]', () => openCategoryForm()),
    on(root, "click", "[data-edit]", (_, el) => openCategoryForm(store.getCategory(el.dataset.edit))),
    on(root, "click", "[data-delete]", async (_, el) => {
      const c = store.getCategory(el.dataset.delete);
      if (!(await confirmDialog({ title: `Delete ${c.name}?`, message: "This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
      try {
        store.deleteCategory(c.id);
        toast("Category deleted", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    }),
  ];
  return () => offs.forEach((off) => off());
}

function openCategoryForm(category) {
  const isNew = !category;
  const used = new Set(store.getCategories().map((c) => c.color));
  const c = category || { name: "", description: "", color: SWATCHES.find((s) => !used.has(s)) || SWATCHES[0] };

  openModal({
    title: isNew ? "New category" : `Edit ${c.name}`,
    size: "sm",
    render(body, close) {
      body.innerHTML = String(html`
        <form class="form">
          <label class="field"><span>Name</span><input name="name" required value="${c.name}" autofocus /></label>
          <label class="field"><span>Description</span><textarea name="description" rows="3">${c.description}</textarea></label>
          <fieldset class="field">
            <legend>Color</legend>
            <div class="swatch-picker">
              ${SWATCHES.map((s) => html`<label style="--cat:${s}"><input type="radio" name="color" value="${s}" ${s === c.color ? "checked" : ""} aria-label="${s}" /></label>`)}
            </div>
          </fieldset>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary">${isNew ? "Create category" : "Save changes"}</button>
          </div>
        </form>
      `);
      const form = body.querySelector("form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = new FormData(form);
        const name = d.get("name").trim();
        const clash = store.getCategories().find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== c.id);
        if (clash) return toast(`"${name}" already exists`, "error");
        store.saveCategory({ ...(isNew ? {} : { id: c.id }), name, description: d.get("description").trim(), color: d.get("color") });
        toast(isNew ? "Category created" : "Category saved", "success");
        close();
      });
    },
  });
}
