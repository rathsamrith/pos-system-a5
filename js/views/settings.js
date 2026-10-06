// Store settings + demo data tools.
import * as store from "../store.js";
import { html, on, downloadFile } from "../utils.js";
import { icon, toast, confirmDialog } from "../ui.js";

export const title = "Settings";

export function mount(root) {
  function render() {
    const s = store.getSettings();
    root.innerHTML = String(html`
      <div class="page narrow">
        <header class="page-head"><div><h1>Settings</h1><p class="muted">Saved in this browser.</p></div></header>

        <form class="card panel form grid-2" data-form>
          <h2 class="span-2">Store</h2>
          <label class="field span-2"><span>Store name</span><input name="storeName" value="${s.storeName}" required /></label>
          <label class="field span-2"><span>Address</span><input name="storeAddress" value="${s.storeAddress}" /></label>
          <label class="field"><span>Phone</span><input name="storePhone" value="${s.storePhone}" /></label>
          <label class="field"><span>Cashier name</span><input name="cashier" value="${s.cashier}" /></label>
          <label class="field span-2"><span>Receipt footer</span><input name="receiptFooter" value="${s.receiptFooter}" /></label>

          <h2 class="span-2">Pricing</h2>
          <label class="field"><span>VAT / tax rate (%)</span><input name="taxRate" type="number" min="0" max="100" step="0.1" value="${s.taxRate}" /></label>
          <label class="field"><span>Currency symbol</span><input name="currencySymbol" maxlength="3" value="${s.currencySymbol}" /></label>
          <label class="check"><input type="checkbox" name="showRiel" ${s.showRiel ? "checked" : ""} /> Show Khmer riel (KHR) equivalent</label>
          <label class="field"><span>KHR per 1 ${s.currencySymbol}</span><input name="rielRate" type="number" min="1" step="1" value="${s.rielRate}" /></label>

          <h2 class="span-2">Appearance</h2>
          <div class="segmented span-2" role="radiogroup" aria-label="Theme">
            ${["system", "light", "dark"].map((t) => html`<label><input type="radio" name="theme" value="${t}" ${s.theme === t ? "checked" : ""} /><span>${t[0].toUpperCase() + t.slice(1)}</span></label>`)}
          </div>

          <div class="modal-actions span-2"><button class="btn btn-primary">${icon("save")}Save settings</button></div>
        </form>

        <section class="card panel">
          <h2>Data</h2>
          <p class="muted">All data lives in this browser's localStorage. Export a backup before resetting.</p>
          <div class="button-row">
            <button class="btn btn-ghost" data-action="export">${icon("download")}Export JSON</button>
            <label class="btn btn-ghost">${icon("upload")}Import JSON<input type="file" accept="application/json" data-import hidden /></label>
            <button class="btn btn-ghost" data-action="reset">${icon("restart_alt")}Reset demo data</button>
            <button class="btn btn-ghost danger" data-action="clear">${icon("delete_forever")}Start empty</button>
          </div>
        </section>
      </div>
    `);
  }
  render();

  const offs = [
    on(root, "submit", "[data-form]", (e, form) => {
      e.preventDefault();
      const d = new FormData(form);
      store.updateSettings({
        storeName: d.get("storeName").trim() || "My Store",
        storeAddress: d.get("storeAddress").trim(),
        storePhone: d.get("storePhone").trim(),
        cashier: d.get("cashier").trim(),
        receiptFooter: d.get("receiptFooter").trim(),
        taxRate: Math.max(0, Number(d.get("taxRate")) || 0),
        currencySymbol: d.get("currencySymbol").trim() || "$",
        showRiel: d.get("showRiel") === "on",
        rielRate: Math.max(1, Number(d.get("rielRate")) || 4100),
        theme: d.get("theme"),
      });
      toast("Settings saved", "success");
      render();
    }),
    // Preview theme immediately on click.
    on(root, "change", '[name="theme"]', (_, el) => store.updateSettings({ theme: el.value })),
    on(root, "click", '[data-action="export"]', () => {
      downloadFile(`rcr-pos-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportData(), "application/json");
    }),
    on(root, "change", "[data-import]", async (_, input) => {
      const file = input.files[0];
      if (!file) return;
      try {
        store.importData(await file.text());
        toast("Data imported", "success");
        render();
      } catch (err) {
        toast(err.message, "error");
      }
    }),
    on(root, "click", '[data-action="reset"]', async () => {
      if (await confirmDialog({ title: "Reset demo data?", message: "Replaces everything with fresh sample products and ~6 weeks of orders.", confirmLabel: "Reset", danger: true })) {
        store.resetDemoData();
        toast("Demo data restored", "success");
        render();
      }
    }),
    on(root, "click", '[data-action="clear"]', async () => {
      if (await confirmDialog({ title: "Start with an empty store?", message: "Deletes all products, categories and orders.", confirmLabel: "Delete everything", danger: true })) {
        store.clearAllData();
        toast("All data cleared", "success");
        render();
      }
    }),
  ];
  return () => offs.forEach((off) => off());
}
