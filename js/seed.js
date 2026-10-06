// Demo data. Generated deterministically relative to "now" so the dashboard
// always has a recent history to show. Replace with an API fetch later.
import { mulberry32, addDays, startOfDay } from "./utils.js";

export const DEFAULT_SETTINGS = {
  storeName: "RCR Mart",
  storeAddress: "St. 371, Phnom Penh, Cambodia",
  storePhone: "+855 12 345 678",
  cashier: "Demo Cashier",
  currencySymbol: "$",
  taxRate: 10, // percent, applied after discount
  showRiel: true,
  rielRate: 4100,
  receiptFooter: "Thank you for shopping with us!",
  theme: "system", // system | light | dark
};

const CATEGORIES = [
  { id: "cat-bev", name: "Beverages", color: "#2a78d6", description: "Soft drinks, water, coffee and tea" },
  { id: "cat-snk", name: "Snacks", color: "#eb6834", description: "Chips, biscuits and sweets" },
  { id: "cat-bak", name: "Bakery", color: "#eda100", description: "Fresh bread and pastries" },
  { id: "cat-dry", name: "Dairy", color: "#1baf7a", description: "Milk, yogurt, cheese and eggs" },
  { id: "cat-prd", name: "Produce", color: "#008300", description: "Fresh fruit and vegetables" },
  { id: "cat-hh", name: "Household", color: "#4a3aa7", description: "Cleaning and home supplies" },
  { id: "cat-pc", name: "Personal Care", color: "#e87ba4", description: "Toiletries and hygiene" },
];

// [sku, name, emoji, categoryId, price, cost, stock]
const PRODUCTS = [
  ["BEV-001", "Mineral Water 500ml", "💧", "cat-bev", 0.5, 0.2, 240],
  ["BEV-002", "Cola Can 330ml", "🥤", "cat-bev", 0.75, 0.4, 180],
  ["BEV-003", "Iced Coffee", "🧋", "cat-bev", 1.75, 0.6, 60],
  ["BEV-004", "Green Tea Bottle", "🍵", "cat-bev", 1.0, 0.45, 90],
  ["BEV-005", "Orange Juice 1L", "🧃", "cat-bev", 2.5, 1.3, 35],
  ["BEV-006", "Energy Drink", "⚡", "cat-bev", 1.25, 0.6, 8],
  ["SNK-001", "Potato Chips", "🥔", "cat-snk", 1.2, 0.55, 120],
  ["SNK-002", "Chocolate Bar", "🍫", "cat-snk", 1.5, 0.7, 75],
  ["SNK-003", "Butter Cookies", "🍪", "cat-snk", 2.25, 1.0, 40],
  ["SNK-004", "Gummy Bears", "🍬", "cat-snk", 1.0, 0.4, 0],
  ["SNK-005", "Roasted Peanuts", "🥜", "cat-snk", 0.9, 0.35, 66],
  ["SNK-006", "Popcorn", "🍿", "cat-snk", 1.4, 0.5, 4],
  ["BAK-001", "Baguette", "🥖", "cat-bak", 0.6, 0.25, 50],
  ["BAK-002", "Croissant", "🥐", "cat-bak", 1.1, 0.45, 30],
  ["BAK-003", "Sliced Bread", "🍞", "cat-bak", 1.8, 0.8, 22],
  ["BAK-004", "Donut", "🍩", "cat-bak", 0.95, 0.35, 18],
  ["BAK-005", "Cupcake", "🧁", "cat-bak", 1.3, 0.5, 12],
  ["DRY-001", "Fresh Milk 1L", "🥛", "cat-dry", 2.1, 1.2, 45],
  ["DRY-002", "Cheddar Cheese", "🧀", "cat-dry", 4.5, 2.6, 15],
  ["DRY-003", "Eggs (10 pack)", "🥚", "cat-dry", 2.4, 1.4, 38],
  ["DRY-004", "Butter 250g", "🧈", "cat-dry", 3.2, 1.9, 6],
  ["DRY-005", "Ice Cream Cup", "🍨", "cat-dry", 1.6, 0.7, 28],
  ["PRD-001", "Bananas (bunch)", "🍌", "cat-prd", 1.5, 0.7, 25],
  ["PRD-002", "Apples (1kg)", "🍎", "cat-prd", 3.0, 1.6, 30],
  ["PRD-003", "Mango", "🥭", "cat-prd", 0.8, 0.35, 60],
  ["PRD-004", "Tomatoes (500g)", "🍅", "cat-prd", 1.2, 0.5, 20],
  ["PRD-005", "Carrots (500g)", "🥕", "cat-prd", 0.9, 0.4, 3],
  ["PRD-006", "Avocado", "🥑", "cat-prd", 1.4, 0.7, 16],
  ["HH-001", "Dish Soap", "🧴", "cat-hh", 2.2, 1.1, 24],
  ["HH-002", "Paper Towels", "🧻", "cat-hh", 3.5, 1.8, 18],
  ["HH-003", "Trash Bags", "🗑️", "cat-hh", 2.8, 1.3, 14],
  ["HH-004", "Sponges (3 pack)", "🧽", "cat-hh", 1.5, 0.6, 30],
  ["PC-001", "Toothpaste", "🪥", "cat-pc", 2.0, 0.9, 26],
  ["PC-002", "Shampoo", "🧴", "cat-pc", 4.2, 2.1, 12],
  ["PC-003", "Hand Soap", "🧼", "cat-pc", 1.8, 0.8, 22],
  ["PC-004", "Tissues", "🤧", "cat-pc", 1.1, 0.45, 2],
];

// Relative popularity of each product when generating order history.
const POPULARITY = {
  "BEV-001": 10, "BEV-002": 8, "BEV-003": 7, "BEV-004": 5, "BAK-001": 6,
  "SNK-001": 6, "SNK-002": 5, "BAK-002": 4, "PRD-003": 4, "DRY-001": 4,
};

const PAYMENT_WEIGHTS = [
  ["cash", 0.55],
  ["qr", 0.3],
  ["card", 0.15],
];

function buildProducts() {
  return PRODUCTS.map(([sku, name, emoji, categoryId, price, cost, stock]) => ({
    id: `prd-${sku.toLowerCase()}`,
    sku,
    name,
    emoji,
    categoryId,
    price: Math.round(price * 100),
    cost: Math.round(cost * 100),
    stock,
    lowStockAt: 10,
    active: true,
  }));
}

function pickWeighted(rand, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function buildOrders(products, settings, days = 45) {
  const rand = mulberry32(20231220);
  const weighted = products.map((p) => [p, POPULARITY[p.sku] || 1.5]);
  const orders = [];
  const now = new Date();
  const today = startOfDay(now);
  let seq = 1;

  for (let d = days; d >= 0; d--) {
    const day = addDays(today, -d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    // Gentle upward trend so the chart has something to say.
    const base = 9 + Math.round((days - d) * 0.12);
    const count = base + Math.floor(rand() * 7) + (weekend ? 6 : 0);

    for (let n = 0; n < count; n++) {
      const hour = 7 + Math.floor(rand() * 14);
      const createdAt = new Date(day);
      createdAt.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (createdAt > now) continue;

      const lineCount = 1 + Math.floor(rand() * 4);
      const lines = new Map();
      for (let l = 0; l < lineCount; l++) {
        const p = pickWeighted(rand, weighted);
        const qty = 1 + Math.floor(rand() * (p.price < 150 ? 3 : 2));
        const existing = lines.get(p.id);
        if (existing) existing.qty += qty;
        else lines.set(p.id, { productId: p.id, sku: p.sku, name: p.name, emoji: p.emoji, price: p.price, cost: p.cost, qty });
      }
      const items = [...lines.values()];
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const discount = rand() < 0.08 ? Math.round(subtotal * 0.1) : 0;
      const tax = Math.round(((subtotal - discount) * settings.taxRate) / 100);
      const total = subtotal - discount + tax;
      const method = pickWeighted(rand, PAYMENT_WEIGHTS);
      const tendered = method === "cash" ? Math.ceil(total / 500) * 500 : total;

      orders.push({
        id: `ord-seed-${seq}`,
        number: `R-${String(seq).padStart(6, "0")}`,
        createdAt: createdAt.toISOString(),
        items,
        subtotal,
        discount,
        taxRate: settings.taxRate,
        tax,
        total,
        payment: { method, tendered, change: tendered - total },
        customer: "",
        cashier: settings.cashier,
        status: rand() < 0.015 ? "refunded" : "paid",
      });
      seq++;
    }
  }
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((o, i) => (o.number = `R-${String(i + 1).padStart(6, "0")}`));
  return orders;
}

export function createSeedState() {
  const settings = { ...DEFAULT_SETTINGS };
  const products = buildProducts();
  return {
    settings,
    categories: CATEGORIES.map((c) => ({ ...c })),
    products,
    orders: buildOrders(products, settings),
    cart: emptyCart(),
  };
}

export function createEmptyState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    categories: [],
    products: [],
    orders: [],
    cart: emptyCart(),
  };
}

export function emptyCart() {
  return { items: [], discount: { type: "percent", value: 0 }, customer: "" };
}
