# RCR Mart POS

A point-of-sale **mockup** for a small mart: a working register, order history, catalog management and a sales dashboard. It's plain HTML, CSS and JavaScript (ES modules) with **no build step and no dependencies**. Data is stored in the browser's `localStorage` and seeded with realistic demo data on first load.

Use it as a clickable demo and as a starting point. The code is organized so the pieces most likely to change (storage, screens, pricing) are each in one place.

## Run it

ES modules don't load from `file://`, so serve the folder over HTTP:

```bash
npm start                 # npx serve on http://localhost:5173
# or
python -m http.server 5173
```

You can also use the VS Code **Live Server** extension. Opening `index.html` directly shows a message explaining this instead of a blank page.

## What's in the demo

| Screen | What it does |
| --- | --- |
| **Register** (`#/register`) | Product grid with search and category filters, cart with qty stepper, % or fixed discount, VAT, optional customer. **Scan mode:** type a SKU (e.g. `BEV-001`) and press Enter. Press `/` to focus search. Pay by cash (quick-tender buttons, change due), card, or QR (both mocked), then a printable receipt. |
| **Orders** (`#/orders`) | History filtered by date range, payment and status, plus search by receipt #, customer or product. Open an order to reprint or **refund** it (refunding restocks the items). CSV export. |
| **Products** (`#/products`) | CRUD with SKU uniqueness, cost/margin, stock and low-stock threshold, hide-from-register toggle. Filter by category or stock level. |
| **Categories** (`#/categories`) | CRUD with color. A category can't be deleted while it still has products. |
| **Dashboard** (`#/dashboard`) | Net sales, orders, average ticket and gross profit vs the previous period. Sales by day/hour chart, top products, payment mix, low stock, recent orders. |
| **Settings** (`#/settings`) | Store info for receipts, tax rate, currency symbol, optional KHR (riel) display, light/dark/system theme. Export/import JSON backup, reset demo data, or start empty. |

It's responsive: below 1080px the cart becomes a slide-over drawer, and below 820px the sidebar becomes a bottom tab bar.

## Project structure

```
index.html              App shell (sidebar + view outlet)
css/app.css             The only stylesheet: tokens (light/dark), components, views, print
image/LOGO/             Brand assets
js/
  main.js               Hash router, nav, theme. Register new screens here.
  store.js              ★ Data layer: the only module that touches storage
  seed.js               Demo catalog + ~6 weeks of generated order history
  utils.js              html`` templating (auto-escaping), money/date helpers, PRNG
  ui.js                 Modal (<dialog>), confirm, toast, icon, empty state
  components/
    receipt.js          Receipt markup (checkout + order history + print)
    charts.js           Small SVG/HTML charts + hover tooltip, no library
  views/                One file per screen: export { title, mount(root) → cleanup }
    register.js  orders.js  products.js  categories.js  dashboard.js  settings.js
```

### Conventions

- **Money is integer cents** everywhere (`price: 175` = $1.75). Convert only at the edges with `toCents` / `formatMoney`.
- **All reads and writes go through `store.js`.** Views never touch `localStorage`. Each mutation calls `commit(tag, fn)`, which saves and notifies `subscribe()` listeners, and views re-render on that notification.
- **Orders keep a copy of each line item** (name, price, cost at sale time), so editing or deleting a product never rewrites history.
- **Stock moves only on checkout or refund.** Adding to the cart reserves nothing, but cart quantities are capped at available stock.
- **Pricing lives in `computeTotals()`:** subtotal → discount → tax on the discounted amount → total. The cart UI and checkout both use it.
- **Templating:** `html` tagged templates escape every interpolated value. Use `raw()` only for trusted markup.
- **Views** are `mount(root)` functions that return a cleanup fn. Use the delegated `on(root, event, selector, handler)` helper for events.

### Data model (`localStorage["rcr-pos:v1"]`)

```js
{
  settings:   { storeName, storeAddress, storePhone, cashier, currencySymbol, taxRate, showRiel, rielRate, receiptFooter, theme },
  categories: [{ id, name, description, color }],
  products:   [{ id, sku, name, emoji, categoryId, price, cost, stock, lowStockAt, active }],
  orders:     [{ id, number, createdAt, items: [{ productId, sku, name, emoji, price, cost, qty }],
                 subtotal, discount, taxRate, tax, total,
                 payment: { method: "cash"|"card"|"qr", tendered, change },
                 customer, cashier, status: "paid"|"refunded", refundedAt? }],
  cart:       { items: [{ productId, qty }], discount: { type: "percent"|"amount", value }, customer }
}
```

## Roadmap ideas for real development

1. **Backend:** replace the body of `store.js` with API calls (making its functions `async`). The function signatures are the contract the views already depend on. Order numbers and stock changes should then become server-side transactions.
2. **Auth and roles:** cashier login, manager-only screens (products, refunds, settings), shift open/close with a cash-drawer count.
3. **Payments:** real card-terminal and KHQR/Bakong integration behind the `checkout(payment)` call.
4. **Hardware:** ESC/POS receipt printer, barcode scanner (the Enter-to-add search already works with keyboard-wedge scanners), cash drawer kick.
5. **Catalog:** product images, variants/modifiers, per-item tax rates, supplier and purchase orders, stock-adjustment log.
6. **Customers and loyalty:** customer records, points, receipt by SMS/Telegram.
7. **Offline-first:** a service worker with IndexedDB queueing so the register keeps selling when the network drops.
8. **Tooling:** if the app outgrows vanilla JS, the view/store split maps directly onto React/Vue/Svelte components plus a store. Add Vitest for `computeTotals` and `checkout` first.

---

Originally a student project by Roth Samreth (Passerelles Numériques, 2023). Reworked into this mockup in 2026.
