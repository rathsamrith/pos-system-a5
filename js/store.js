// The single data layer. Every read/write of app data goes through here, so
// swapping localStorage for a real backend later only touches this file.
//
// Conventions:
//   - all money is integer cents
//   - orders snapshot product name/price at sale time (history survives edits)
//   - stock is decremented on checkout, restored on refund
import { createSeedState, createEmptyState, emptyCart, DEFAULT_SETTINGS } from "./seed.js";
import { uid } from "./utils.js";

const STORAGE_KEY = "rcr-pos:v1";
const LEGACY_KEYS = ["productItems", "cartItems", "allCategory", "customerRecord"];

let state = load();
const listeners = new Set();

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      parsed.cart = parsed.cart || emptyCart();
      return parsed;
    }
  } catch (err) {
    console.warn("Could not read saved data, starting fresh.", err);
  }
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  const seeded = createSeedState();
  persist(seeded);
  return seeded;
}

function persist(next = state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Saving failed", err);
  }
}

/** Apply a mutation, persist, and notify subscribers with a change tag. */
function commit(change, mutate) {
  mutate(state);
  persist();
  listeners.forEach((fn) => fn(change));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- settings
export const getSettings = () => state.settings;

export function updateSettings(patch) {
  commit("settings", (s) => Object.assign(s.settings, patch));
}

// -------------------------------------------------------------- categories
export const getCategories = () => [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
export const getCategory = (id) => state.categories.find((c) => c.id === id);

export function saveCategory(input) {
  commit("categories", (s) => {
    if (input.id) {
      Object.assign(s.categories.find((c) => c.id === input.id), input);
    } else {
      s.categories.push({ ...input, id: uid("cat-") });
    }
  });
}

export function deleteCategory(id) {
  if (state.products.some((p) => p.categoryId === id)) {
    throw new Error("Move or delete the products in this category first.");
  }
  commit("categories", (s) => {
    s.categories = s.categories.filter((c) => c.id !== id);
  });
}

// ---------------------------------------------------------------- products
export const getProducts = () => state.products;
export const getProduct = (id) => state.products.find((p) => p.id === id);
export const findProductBySku = (sku) =>
  state.products.find((p) => p.sku.toLowerCase() === String(sku).trim().toLowerCase());

export function saveProduct(input) {
  const clash = state.products.find(
    (p) => p.sku.toLowerCase() === input.sku.toLowerCase() && p.id !== input.id
  );
  if (clash) throw new Error(`SKU "${input.sku}" is already used by ${clash.name}.`);
  commit("products", (s) => {
    if (input.id) {
      Object.assign(s.products.find((p) => p.id === input.id), input);
    } else {
      s.products.push({ lowStockAt: 10, active: true, ...input, id: uid("prd-") });
    }
  });
}

export function deleteProduct(id) {
  commit("products", (s) => {
    s.products = s.products.filter((p) => p.id !== id);
    s.cart.items = s.cart.items.filter((i) => i.productId !== id);
  });
}

// -------------------------------------------------------------------- cart
export const getCart = () => state.cart;

/** Cart lines joined with live product data. Lines whose product vanished are dropped. */
export function getCartLines() {
  return state.cart.items
    .map((item) => ({ ...item, product: getProduct(item.productId) }))
    .filter((line) => line.product);
}

export function cartQtyFor(productId) {
  return state.cart.items.find((i) => i.productId === productId)?.qty || 0;
}

/** Returns false if there isn't enough stock. */
export function addToCart(productId, qty = 1) {
  const product = getProduct(productId);
  if (!product) return false;
  if (cartQtyFor(productId) + qty > product.stock) return false;
  commit("cart", (s) => {
    const line = s.cart.items.find((i) => i.productId === productId);
    if (line) line.qty += qty;
    else s.cart.items.push({ productId, qty });
  });
  return true;
}

export function setCartQty(productId, qty) {
  const product = getProduct(productId);
  const clamped = Math.max(0, Math.min(qty, product ? product.stock : 0));
  commit("cart", (s) => {
    if (clamped === 0) s.cart.items = s.cart.items.filter((i) => i.productId !== productId);
    else s.cart.items.find((i) => i.productId === productId).qty = clamped;
  });
  return clamped === qty;
}

export function setCartDiscount(discount) {
  commit("cart", (s) => (s.cart.discount = discount));
}

export function setCartCustomer(customer) {
  commit("cart", (s) => (s.cart.customer = customer));
}

export function clearCart() {
  commit("cart", (s) => (s.cart = emptyCart()));
}

/** Pure pricing function, shared by the cart UI and checkout. */
export function computeTotals(lines, discount, taxRate) {
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  let discountCents = 0;
  if (discount?.value > 0) {
    discountCents =
      discount.type === "percent"
        ? Math.round((subtotal * Math.min(discount.value, 100)) / 100)
        : Math.min(Math.round(discount.value * 100), subtotal);
  }
  const taxable = subtotal - discountCents;
  const tax = Math.round((taxable * taxRate) / 100);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  return { subtotal, discount: discountCents, tax, total: taxable + tax, itemCount };
}

export const getCartTotals = () =>
  computeTotals(getCartLines(), state.cart.discount, state.settings.taxRate);

// ------------------------------------------------------------------ orders
export const getOrders = () => state.orders;
export const getOrder = (id) => state.orders.find((o) => o.id === id);

function nextOrderNumber() {
  const max = state.orders.reduce((m, o) => Math.max(m, parseInt(o.number.slice(2), 10) || 0), 0);
  return `R-${String(max + 1).padStart(6, "0")}`;
}

/**
 * Turn the current cart into a paid order.
 * payment: { method: "cash" | "card" | "qr", tendered: cents }
 */
export function checkout(payment) {
  const lines = getCartLines();
  if (lines.length === 0) throw new Error("Cart is empty.");
  for (const l of lines) {
    if (l.qty > l.product.stock) throw new Error(`Only ${l.product.stock} × ${l.product.name} left in stock.`);
  }
  const { settings } = state;
  const totals = computeTotals(lines, state.cart.discount, settings.taxRate);
  const tendered = payment.method === "cash" ? payment.tendered : totals.total;
  if (tendered < totals.total) throw new Error("Amount tendered is less than the total.");

  const order = {
    id: uid("ord-"),
    number: nextOrderNumber(),
    createdAt: new Date().toISOString(),
    items: lines.map((l) => ({
      productId: l.product.id,
      sku: l.product.sku,
      name: l.product.name,
      emoji: l.product.emoji,
      price: l.product.price,
      cost: l.product.cost,
      qty: l.qty,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxRate: settings.taxRate,
    tax: totals.tax,
    total: totals.total,
    payment: { method: payment.method, tendered, change: tendered - totals.total },
    customer: state.cart.customer.trim(),
    cashier: settings.cashier,
    status: "paid",
  };

  commit("orders", (s) => {
    for (const item of order.items) {
      const p = s.products.find((x) => x.id === item.productId);
      if (p) p.stock -= item.qty;
    }
    s.orders.push(order);
    s.cart = emptyCart();
  });
  return order;
}

export function refundOrder(id) {
  commit("orders", (s) => {
    const order = s.orders.find((o) => o.id === id);
    if (!order || order.status === "refunded") return;
    order.status = "refunded";
    order.refundedAt = new Date().toISOString();
    for (const item of order.items) {
      const p = s.products.find((x) => x.id === item.productId);
      if (p) p.stock += item.qty;
    }
  });
}

// -------------------------------------------------------------------- data
export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.products) || !Array.isArray(data.orders) || !Array.isArray(data.categories)) {
    throw new Error("That file doesn't look like a RCR POS export.");
  }
  replaceState({ ...createEmptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } });
}

export const resetDemoData = () => replaceState(createSeedState());
export const clearAllData = () => replaceState(createEmptyState());

function replaceState(next) {
  state = next;
  persist();
  listeners.forEach((fn) => fn("all"));
}
