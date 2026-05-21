# Architecture — Multi-Tenant Inventory Management System

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                       │
│  Vite · React Router · Ant Design · Recharts · Socket.io-c  │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP (REST) + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (Node / Express)                    │
│  JWT Auth ──► Tenant Guard ──► RBAC ──► Controllers          │
│                                            │                 │
│                                       Services               │
│                                    stockService.js           │
│                                    alertService.js           │
│                                            │                 │
│  Socket.io ◄────── emitToTenant() ◄────────┘                 │
└───────────────────────────┬─────────────────────────────────┘
                            │  Mongoose ODM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   MongoDB Atlas (M0 Free Tier)               │
│  tenants · users · products · stockmovements                 │
│  suppliers · purchaseorders · orders                         │
└─────────────────────────────────────────────────────────────┘
```

**API Documentation:** `GET http://localhost:5000/api/docs` (Swagger UI)

---

## 1. Multi-Tenant Architecture

### Strategy: Row-Level Isolation with `tenantId`

Every document in every collection carries a `tenantId: ObjectId` field that
references the `tenants` collection. This field is the single source of truth
for data ownership — it is never derived from the request body.

```
collections:  tenants  users  products  stockmovements  suppliers  purchaseorders  orders
              ───────  ─────  ────────  ──────────────  ─────────  ─────────────  ──────
tenantId:       PK      FK      FK           FK             FK           FK          FK
```

### How Isolation Is Enforced

Isolation is enforced **centrally in middleware**, not per-controller. This
eliminates the entire class of bugs where a developer forgets to scope a query.

```
1. Client sends:   Authorization: Bearer <JWT>

2. auth.js decodes the JWT and injects:
     req.tenantId = new ObjectId(payload.tenantId)  ← real ObjectId, not a string
     req.userId   = payload.userId
     req.userRole = payload.role

3. Every controller queries:
     { _id: req.params.id, tenantId: req.tenantId }
   A document owned by Tenant B cannot be returned to Tenant A —
   even if Tenant A guesses the ObjectId — because tenantId won't match.
```

### Index Design for Tenant Isolation

All compound indexes have `tenantId` as the **leading key**. This means every
query starts with an equality filter on `tenantId`, reducing the scanned set to
only that tenant's documents before applying any other filter.

```
Collection        Index
──────────────    ──────────────────────────────────────────────
Product           { tenantId: 1 }
                  { tenantId: 1, category: 1 }
                  { tenantId: 1, "variants.sku": 1 }
                  { tenantId: 1, name: "text", brand: "text" }  ← full-text
PurchaseOrder     { tenantId: 1, status: 1 }
                  { tenantId: 1, createdAt: -1 }
Order             { tenantId: 1, status: 1 }
                  { tenantId: 1, createdAt: -1 }
StockMovement     { tenantId: 1, createdAt: -1 }
                  { tenantId: 1, productId: 1, createdAt: -1 }
                  { tenantId: 1, type: 1, createdAt: -1 }       ← top-sellers query
User              { tenantId: 1, email: 1 }  unique
```

### Why Row-Level, Not Separate Databases?

| Concern | Row-Level (chosen) | Separate DB |
|---|---|---|
| Connection pool | Single pool, scales to N tenants | One pool per tenant, exhausts at ~100 tenants |
| Ops complexity | One Atlas cluster to monitor | One cluster per tenant |
| Cross-tenant admin queries | Possible via aggregation | Requires fan-out across DBs |
| Data leakage risk | Prevented by middleware guard | Prevented by network isolation |
| Atlas M0 compatibility | ✅ Works | ❌ Needs many Atlas clusters |

### RBAC: Roles Within a Tenant

Three roles with a numeric hierarchy: `owner (3) > manager (2) > staff (1)`

**Backend — applied as route middleware:**
```js
// middleware/rbac.js
const ROLE_HIERARCHY = { owner: 3, manager: 2, staff: 1 };

const requireRole = (...allowed) => (req, res, next) => {
  if (ROLE_HIERARCHY[req.userRole] >= Math.min(...allowed.map(r => ROLE_HIERARCHY[r])))
    return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};
```

**Frontend — `useRole()` hook as single source of truth:**
```js
// hooks/useRole.js — used in every page/component that gates UI
const { isManagerOrAbove, can } = useRole();
```
`RoleRoute` wraps React Router routes to redirect staff away from
manager-only pages. Individual pages use `isManagerOrAbove` to
conditionally render Add, Edit, Delete, and action buttons.

**Permissions matrix:**

| Action | staff | manager | owner |
|---|---|---|---|
| View all resources | ✅ | ✅ | ✅ |
| Create / edit products & suppliers | ❌ | ✅ | ✅ |
| Manual stock adjustment | ❌ | ✅ | ✅ |
| Soft-delete / restore products | ❌ | ✅ | ✅ |
| Create / receive Purchase Orders | ❌ | ✅ | ✅ |
| Confirm / ship / cancel / fulfill Orders | ❌ | ✅ | ✅ |
| View User Management | ❌ | ✅ | ✅ |
| Invite users / change roles | ❌ | ❌ | ✅ |

---

## 2. Complex Inventory

### 2a. Product & Variant Schema

Each product has **embedded variants** — no separate `ProductVariant` collection.

```js
Product {
  tenantId,                            // tenant ownership
  name, description, category, brand,
  supplierId,                          // ref → Supplier
  attributes: ["size", "color"],       // variant dimension names
  variants: [{
    sku,                               // globally unique per tenant
    attributes: { size:"M", color:"Red" },  // Map<String,String>
    stock,                             // current available units
    reservedStock,                     // held by pending/confirmed orders
    costPrice,
    sellingPrice,
    lowStockThreshold,                 // per-variant alert trigger (default: 10)
  }],
  isActive,                            // soft-delete flag
  tags: [String]                       // full-text search tokens
}
```

**Why embedded variants?**

1. **Single read, all data** — `Product.findById()` returns the product AND
   all its variants in one round-trip. No joins, no `$lookup`.

2. **Atomic stock update** — MongoDB's positional operator `$` targets a
   single subdocument inside an array in one `findOneAndUpdate` call. This
   is the mechanism that prevents race conditions (see §2c).

3. **Safe denormalisation** — variants are tightly owned by one product.
   They are never shared across products, so there is no update-anomaly risk.

### 2b. Soft Delete & Restore

Products are **never hard-deleted**. Setting `isActive: false` hides them from
all default queries. `PATCH /api/products/:id/restore` sets it back to `true`.

```
Default queries:  { tenantId, isActive: true }           → active only
?isActive=false:  { tenantId, isActive: false }          → deactivated only
?isActive=all:    { tenantId }                           → everything
```

This preserves historical references — orders and stock movements that point
to a deactivated product still resolve correctly.

### 2c. Concurrent Stock Deduction (Race-Condition Safety)

**The problem:** Two users simultaneously order the last unit.

```
Naive (broken) approach:
  Thread A: reads stock=1 → ok, proceeds
  Thread B: reads stock=1 → ok, proceeds      ← both pass the check
  Thread A: writes stock-1 = 0
  Thread B: writes stock-1 = -1               ← oversell!
```

**Our solution: combine the guard and the decrement into one atomic operation.**

```js
// stockService.js — deductOneVariant()
const updated = await Product.findOneAndUpdate(
  {
    _id: productId,
    tenantId,
    variants: {
      $elemMatch: {
        sku,
        stock: { $gte: quantity }   // ← the guard IS the query filter
      }
    }
  },
  { $inc: { 'variants.$.stock': -quantity } },
  { new: true }
);

if (!updated) throw new InsufficientStockError(sku, available, quantity);
```

MongoDB processes `findOneAndUpdate` as a single atomic operation at the
document level. If two requests arrive simultaneously:

```
Request A: findOneAndUpdate (stock=1 ≥ 1) → MATCH → stock becomes 0  → 201 ✓
Request B: findOneAndUpdate (stock=0 ≥ 1) → NO MATCH → null          → 409 ✗
```

There is no window between the check and the write. Exactly one request wins.

**Multi-item rollback (Atlas M0 has no multi-document transactions):**

```js
// Items are deducted one by one. If item N fails, items 0..N-1 are rolled back.
const completed = [];
try {
  for (const item of items) {
    completed.push(await deductOneVariant(...item));
  }
} catch (err) {
  for (const done of completed) {
    await addOneVariant(...done).catch(() => {}); // best-effort, never masks original error
  }
  throw err;  // surfaces as HTTP 409
}
```

**Verified by:** `server/scripts/testConcurrency.js` — fires 10 simultaneous
requests for the last 1 unit. Result: exactly 1 × HTTP 201, 9 × HTTP 409.

### 2d. Stock Movement Audit Log

`StockMovement` is an **append-only** collection. Every stock change — whether
from an order, a PO receipt, a cancellation, or a manual adjustment — inserts
a new document. Records are never updated or deleted.

| `type` | `quantity` sign | Triggered by |
|---|---|---|
| `purchase` | positive | PO receive |
| `sale` | negative | Order creation |
| `return` | positive | Order cancellation (unfulfilled qty only) |
| `adjustment` | ± | Manual stock adjustment endpoint |

Each record captures: `previousStock`, `newStock`, `referenceId` (links back
to the originating Order or PO), and `performedBy` (User ObjectId).

This log feeds the 7-day stock graph on the dashboard and provides a full
auditable trail for every unit that ever moved.

### 2e. Partial Fulfillment

Sales orders track physical dispatch separately from stock deduction.
Stock is deducted **atomically at order creation** — fulfillment records
only how many units were actually dispatched to the customer.

```
POST /api/orders/:id/fulfill
Body: { items: [{ variantSku, quantity }] }   ← quantity dispatched in THIS batch
```

Each call increments `item.fulfilledQuantity`. The order auto-transitions:

```
all items: fulfilledQty === orderedQty  →  delivered
some items: fulfilledQty < orderedQty  →  partially_fulfilled
```

If a partially-fulfilled order is later cancelled, **only the unfulfilled
quantity is released back** to stock:

```js
const itemsToRelease = order.items
  .filter(i => i.quantity > (i.fulfilledQuantity || 0))
  .map(i => ({ quantity: i.quantity - i.fulfilledQuantity, ... }));
```

---

## 3. Suppliers & Purchase Orders

### 3a. Supplier Model

```js
Supplier {
  tenantId,
  name, email, phone, address, contactPerson,
  products: [{             // optional default pricing per product
    productId,
    defaultUnitPrice,
    leadTimeDays,
  }],
  isActive,
}
```

Suppliers are linked to products via `Product.supplierId`. The product list
can be filtered by `supplierId`, and navigating from a supplier's detail page
pre-fills that filter automatically (URL param `?supplierId=...&supplierName=...`).

### 3b. Purchase Order Lifecycle

```
                    ┌─────────┐
                    │  draft  │  ← created, not yet submitted
                    └────┬────┘
                         │  submit to supplier
                    ┌────▼────┐
                    │  sent   │  ← pending supplier acknowledgement
                    └────┬────┘
                         │  supplier confirms
                    ┌────▼────┐
                    │confirmed│  ← goods being prepared / shipped
                    └────┬────┘
               ┌─────────┴──────────┐
               │ partial delivery   │ full delivery
      ┌────────▼────────┐    ┌──────▼──────┐
      │partially_received│    │  received   │
      └─────────────────┘    └─────────────┘

  cancelled ← from any status before received
```

**Key transitions and what they trigger:**

| Transition | What happens |
|---|---|
| `draft → sent` | PO quantities NOW count in smart low-stock alerts |
| `sent → confirmed` | PO quantities continue to suppress alerts |
| `confirmed → received / partially_received` | `stockService.addStock()` increments each variant; `purchase` StockMovement created per item |
| `any → cancelled` | PO quantities removed from alert calculations; no stock change |

### 3c. Receiving Items (Partial Delivery Support)

```
POST /api/purchase-orders/:id/receive
Body: { items: [{ variantSku, receivedQuantity }] }
```

Each call:
1. Validates `existingReceivedQty + newQty ≤ orderedQty` per item
2. Increments `item.receivedQuantity`
3. Calls `stockService.addStock()` — increments `variants.$.stock` atomically
4. Creates a `purchase` StockMovement for each item
5. Auto-transitions PO status:
   - All items fully received → `received`
   - Some items still pending → `partially_received`

### 3d. How Purchase Orders Affect Low-Stock Alerts

This is the core of the **smart alert system**. When stock drops below
`lowStockThreshold`, we do NOT immediately alert if a PO is already on its way.

```js
// alertService.js — buildPendingPOMap()
// Only counts POs with status "sent" or "confirmed"
// Draft POs are excluded (not yet committed to the supplier)
// Received/cancelled POs are excluded (already processed or void)

const key = `${productId}::${variantSku}`;  // composite key prevents SKU collisions
pendingQty = sum of (item.quantity - item.receivedQuantity) per matching PO item

effectiveStock = variant.stock + pendingQty

if (effectiveStock >= lowStockThreshold) → SKIP (PO covers the gap)
else                                     → ALERT (still needs restocking)
```

**Three-state display on the product list:**

| Variant tag colour | Condition | Meaning |
|---|---|---|
| 🔴 Red + ⚠ | `stock < threshold` AND no covering PO | Needs restocking now |
| 🟠 Orange + 📦 | `stock < threshold` BUT covering PO exists | PO in transit — no action needed |
| ⬜ Default | `stock ≥ threshold` | Healthy |

---

## 4. Dashboard — Performance Design

The dashboard loads **4 widgets in parallel** (`Promise.all`) and must
complete in under 2 seconds even with 10,000+ products.

```js
// Dashboard.jsx — all 4 requests fired simultaneously
const [statsRes, lowStockRes, topSellersRes, graphRes] = await Promise.all([
  api.get('/dashboard/stats'),
  api.get('/dashboard/low-stock'),
  api.get('/dashboard/top-sellers'),
  api.get('/dashboard/stock-graph'),
]);
```

### Widget 1 — Inventory Value & KPIs

**What it shows:** Total products, total orders, total inventory value
(cost basis), total revenue (delivered orders), low-stock count, pending orders.

**How it's fast:**

```js
// Single aggregation pass over Product collection
Product.aggregate([
  { $match: { tenantId, isActive: true } },          // ← hits { tenantId:1 } index
  { $unwind: '$variants' },
  { $group: {
      _id: null,
      totalProducts:       { $addToSet: '$_id' },
      totalInventoryValue: { $sum: { $multiply: ['$variants.costPrice', '$variants.stock'] } },
  }},
])
```

- `$match` on `tenantId` uses an index scan, not a collection scan.
- `$unwind` + `$group` computes inventory value in a **single pipeline pass**
  — no application-level loops.
- Revenue and order counts use `countDocuments` + `aggregate` on `Order`,
  both scoped by `{ tenantId, status }` which hits `{ tenantId:1, status:1 }`.

### Widget 2 — Low-Stock Alerts (PO-Aware)

**What it shows:** Variants that still need restocking after accounting for
pending Purchase Orders. Sorted: critical (stock=0) first, then by deficit size.

**How it's fast:**

```js
// alertService.getSmartLowStockAlerts()
// Step 1: load only active products for this tenant (index scan)
Product.find({ tenantId, isActive: true })
  .select('name category variants supplierId')   // ← project only needed fields
  .lean()                                         // ← plain objects, no Mongoose overhead

// Step 2: load only sent/confirmed POs (index scan on { tenantId, status })
PurchaseOrder.find({ tenantId, status: { $in: ['sent', 'confirmed'] } })
  .select('items')
  .lean()

// Step 3: pure JS — build map, iterate variants, compute effectiveStock
// No second DB round-trip needed
```

Both queries run in parallel. The comparison logic runs in memory
on the Node process — no aggregation pipeline needed for this step.

**Dual-count system** (one endpoint serves two UI needs):

```
rawCount  = products with ≥1 variant below threshold (for product-list badge)
count     = smart alert count after PO deduction     (for dashboard KPI)
data      = variant-level alert objects              (for dashboard table)
```

`rawCount` uses a `$filter`-based aggregation. Plain `$elemMatch + $expr`
cannot compare two fields inside the same array element — `$expr` resolves
`$fieldName` against the root document, not the subdocument. The fix:

```js
{ $size: { $filter: {
    input: '$variants',
    as:    'v',
    cond:  { $lt: ['$$v.stock', '$$v.lowStockThreshold'] }  // $$v = element alias
} } }
```

### Widget 3 — Top 5 Sellers (Last 30 Days)

**What it shows:** The 5 variant SKUs with the highest total units sold in
the past 30 days.

**How it's fast:**

```js
StockMovement.aggregate([
  {
    $match: {
      tenantId,
      type: 'sale',
      createdAt: { $gte: thirtyDaysAgo },  // Date.UTC(...) — never setHours()
    }
    // ↑ hits compound index { tenantId:1, type:1, createdAt:-1 }
    // MongoDB resolves this with a bounded index range scan on 3 fields
  },
  {
    $group: {
      _id:       '$variantSku',
      totalSold: { $sum: { $abs: '$quantity' } },
      productId: { $first: '$productId' },
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 5 },
  // $lookup to enrich with product name — only 5 documents at this point
])
```

The compound index means MongoDB never reads a StockMovement document
that belongs to a different tenant, a different type, or outside the 30-day
window. The `$group`, `$sort`, and `$limit` operate on the already-filtered set.

### Widget 4 — Stock Movement Graph (Last 7 Days)

**What it shows:** A bar chart with daily `stockIn` and `stockOut` totals
for the past 7 days.

**How it's fast:**

```js
StockMovement.aggregate([
  {
    $match: {
      tenantId,
      createdAt: { $gte: sevenDaysAgo },
      // ↑ hits { tenantId:1, createdAt:-1 } index
    }
  },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
      stockIn:  { $sum: { $cond: [{ $gt: ['$quantity', 0] }, '$quantity', 0] } },
      stockOut: { $sum: { $cond: [{ $lt: ['$quantity', 0] }, { $abs: '$quantity' }, 0] } },
    }
  },
  { $sort: { _id: 1 } },
])
```

**Why `Date.UTC(...)` not `setHours(0,0,0,0)`:**  
`setHours(0,0,0,0)` sets midnight in the **local timezone** of the Node process.
On a server running in IST (UTC+5:30), this produces a boundary 5.5 hours off
from true UTC midnight, causing wrong day-groupings in the aggregation.
`Date.UTC(y, m, d)` always produces exact UTC midnight regardless of server
timezone.

### Performance Summary

| Widget | Primary index used | Documents scanned |
|---|---|---|
| Inventory value | `{ tenantId:1 }` on Product | All active products for tenant |
| Low-stock alerts | `{ tenantId:1, status:1 }` on PO | Only sent/confirmed POs |
| Top 5 sellers | `{ tenantId:1, type:1, createdAt:-1 }` on StockMovement | Only sales in last 30 days |
| Stock graph | `{ tenantId:1, createdAt:-1 }` on StockMovement | Only movements in last 7 days |

Every `$match` stage leads with `tenantId` — MongoDB performs a **bounded
index range scan** into just that tenant's partition. With 10,000 products
spread across N tenants, each query scans only `10,000 / N` products.

---

## 5. Real-Time (Socket.io)

- On login the client joins room `tenant:{tenantId}`.
- `emitToTenant(tenantId, event, data)` broadcasts only to that room.

| Event | Triggered after | Payload |
|---|---|---|
| `stock:updated` | Any stock change (order, PO receive, adjustment) | `{ productId, sku, newStock }` |
| `stock:low` | Smart-alert check fires post-deduction | `{ variantSku, currentStock, effectiveStock, threshold, severity, pendingPOQty }` |

`notifyLowStockIfNeeded()` runs the PO-coverage check **before** emitting
`stock:low` — so alerts are never fired for variants already covered by a
pending PO, even in real-time.

---

## 6. API Documentation

Swagger UI is available at **`GET /api/docs`** with all 34 endpoints documented,
including request/response schemas, role requirements, and a seed credentials
table for quick login.

The Swagger UI is mounted **before** `helmet()` in `app.js` so Helmet's
Content Security Policy does not block the UI's inline scripts and styles.

```js
// app.js — order matters
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, {
  swaggerOptions: { persistAuthorization: true },  // token survives page refresh
}));
app.use(helmet());   // applied after /api/docs
```

---

## 7. Key Design Trade-offs

| Decision | Chosen approach | Alternative considered | Reason |
|---|---|---|---|
| Multi-tenancy | Row-level `tenantId` | Separate DB per tenant | No connection pool explosion; works on Atlas M0 |
| Variant storage | Embedded array in Product | Separate `variants` collection | Enables atomic `$elemMatch` update; one read for all data |
| Stock deduction | `findOneAndUpdate` + `$gte` guard | Optimistic locking with retry | MongoDB native atomicity; no retry loop; works without transactions |
| Multi-item rollback | Manual rollback loop | MongoDB multi-document transaction | Atlas M0 doesn't support transactions; document-level atomicity suffices |
| Low-stock alerts | PO-aware (smart) | Simple threshold check | Eliminates false alarms; managers only see items that truly need action |
| Alert counting | `$filter` aggregation | `$elemMatch + $expr` | `$expr` inside `$elemMatch` resolves paths against root doc, not array element |
| PO-safe count | `new Set(alerts.map(a => a.productId))` | Subtract `alerts.length` | `rawCount` is products; `alerts.length` is variants — different units |
| Audit log | Append-only `StockMovement` | Update counter on Product | Full history preserved; feeds graphs and reporting |
| Auth | Stateless JWT | Session/cookie | Stateless — scales horizontally; no session store needed |
| Frontend RBAC | `useRole()` hook + `RoleRoute` | Ad-hoc checks per page | Single source of truth; no drift between pages |
| Date boundaries | `Date.UTC(y, m, d)` | `setHours(0,0,0,0)` | `setHours` uses server local timezone — wrong UTC boundaries in IST |
| Partial fulfillment | Separate `POST /fulfill` endpoint | Status-only transition | Tracks per-item `fulfilledQuantity`; cancellation releases only unfulfilled stock |

---

## 8. File Structure

```
mern-assignment/
├── server/
│   ├── app.js                    — Express setup, Swagger UI, route mounting
│   ├── server.js                 — HTTP server + Socket.io bootstrap
│   ├── seed/seed.js              — Idempotent seed: 2 tenants, realistic data
│   ├── scripts/testConcurrency.js— Fires 10 simultaneous orders; proves 1 wins
│   └── src/
│       ├── config/
│       │   ├── db.js             — Mongoose connection with retry
│       │   └── swagger.js        — Full OpenAPI 3.0 spec (34 endpoints)
│       ├── middleware/
│       │   ├── auth.js           — JWT verify → req.tenantId, req.userRole
│       │   ├── rbac.js           — requireRole factory (ownerOnly, managerOrAbove)
│       │   └── errorHandler.js
│       ├── models/
│       │   ├── Tenant.js
│       │   ├── User.js
│       │   ├── Product.js        — embedded variants, compound indexes
│       │   ├── StockMovement.js  — append-only audit log
│       │   ├── Supplier.js
│       │   ├── PurchaseOrder.js  — status machine, statusHistory
│       │   └── Order.js          — fulfilledQuantity per item, statusHistory
│       ├── controllers/          — one file per resource
│       ├── services/
│       │   ├── stockService.js   — deductStock (atomic), addStock, rollback
│       │   └── alertService.js   — getSmartLowStockAlerts, notifyLowStockIfNeeded
│       └── socket/index.js       — Socket.io init, emitToTenant
└── client/
    └── src/
        ├── api/axios.js          — Axios instance with JWT interceptor
        ├── context/
        │   ├── AuthContext.jsx   — user state, login/logout
        │   └── SocketContext.jsx — socket connection, tenant room join
        ├── hooks/
        │   ├── useAuth.js
        │   ├── useSocket.js
        │   └── useRole.js        — isManagerOrAbove, can(minRole)
        ├── components/
        │   ├── Layout/           — AppLayout, Sidebar (role-filtered), Header
        │   ├── PrivateRoute.jsx  — redirects unauthenticated users
        │   ├── RoleRoute.jsx     — redirects insufficient-role users to /
        │   └── StockAlertListener.jsx — real-time toast notifications
        └── pages/
            ├── Dashboard.jsx           — KPI cards, charts, smart alert table
            ├── products/
            │   ├── ProductList.jsx     — 3-state variant tags, restore button
            │   └── ProductForm.jsx     — variant builder
            ├── suppliers/
            ├── purchaseOrders/         — PO list, detail, receive-items modal
            ├── orders/
            │   ├── OrderList.jsx
            │   ├── OrderDetail.jsx     — fulfill-items modal, progress bars
            │   └── OrderForm.jsx
            ├── inventory/              — StockMovement filterable history
            └── users/                  — owner + manager only
```
