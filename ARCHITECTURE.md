# Architecture — Multi-Tenant Inventory Management System

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                       │
│  Vite · React Router · Ant Design · Recharts · Socket.io-c  │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (Node / Express)                    │
│  JWT Auth ──► RBAC ──► Controllers ──► Services             │
│                                   │                          │
│  Socket.io ◄──── emitToTenant() ◄─┘                         │
└───────────────────────────┬─────────────────────────────────┘
                            │  Mongoose ODM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas                           │
│  Collections: tenants, users, products, stockmovements,     │
│               suppliers, purchaseorders, orders              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Multi-Tenancy Model

**Chosen strategy: Row-Level Isolation via `tenantId` field**

Every document in every collection carries a `tenantId: ObjectId` field.  
All Mongoose compound indexes include `tenantId` as the leading key so MongoDB
can enforce isolation at the index level and guarantee fast queries per tenant.

```
Index examples:
  { tenantId: 1, "variants.sku": 1 }   — Product lookup
  { tenantId: 1, status: 1 }           — Order/PO filters
  { tenantId: 1, createdAt: -1 }       — Time-sorted lists
```

**Why not separate databases per tenant?**  
Row-level isolation is simpler to manage, avoids connection pool explosion
for many tenants, and allows aggregated admin reporting. A collection-scan
cross-tenant query is impossible because every query is automatically scoped
by the auth middleware (not by controller convention, which is error-prone).

### Enforcement

```
JWT payload ──► auth middleware ──► req.tenantId (ObjectId)
                                        │
                        Every controller only queries
                        { tenantId: req.tenantId, ...otherFilters }
```

`req.tenantId` is injected by `middleware/auth.js` on every protected route.
Controllers never accept a tenant from the request body — they can only read
their own tenant's data.

---

## 2. Product & Variant Schema

Products use **embedded variants** (not a separate `ProductVariant` collection).

```js
Product {
  tenantId, name, category, brand, supplierId,
  attributes: ["size", "color"],   // variant dimension names
  variants: [{
    sku,                           // unique per tenant
    attributes: Map<String,String>,// { size:"M", color:"Red" }
    stock,                         // current available stock
    reservedStock,                 // held by pending orders
    costPrice, sellingPrice,
    lowStockThreshold              // per-variant, defaults to 10
  }]
}
```

**Why embedded?**  
- A single `Product.findById()` fetches all variants (no join needed).  
- Atomic `findOneAndUpdate` with positional operator `$` can target one variant inside the document — this is the foundation of the race-condition-free stock deduction.  
- Denormalisation is safe here: variants are tightly owned by one product.

---

## 3. Concurrency — Atomic Stock Deduction

**Problem:** Two simultaneous orders for the last unit must not both succeed.

**Solution: Single-document atomic update with a query guard**

```js
// stockService.deductStock() — runs inside a MongoDB session/transaction
const updated = await Product.findOneAndUpdate(
  {
    _id: productId,
    tenantId,
    variants: {
      $elemMatch: {
        sku,
        stock: { $gte: quantity }   // ← guard: only match if enough stock
      }
    }
  },
  { $inc: { "variants.$.stock": -quantity } },
  { new: true, session }
);

if (!updated) throw new InsufficientStockError(sku);
```

If the stock has already been taken by another concurrent request, the
`$elemMatch` on `stock: { $gte: quantity }` will not match, `findOneAndUpdate`
returns `null`, and we throw a `409 Conflict`.

**Multi-item orders** use MongoDB sessions + transactions so that a basket of
N items either fully deducts or fully rolls back — no partial deductions.

**Verified by:** `server/scripts/testConcurrency.js` fires 10 simultaneous
requests for the last 1 unit; exactly 1 succeeds (HTTP 201), 9 fail with 409.

---

## 4. Stock Movement Audit Log

`StockMovement` is an **append-only** collection — records are never updated
or deleted, only inserted. Each stock change creates a movement:

| type        | quantity sign | triggered by              |
|-------------|---------------|---------------------------|
| `purchase`  | positive      | PO receipt                |
| `sale`      | negative      | Order creation            |
| `return`    | positive      | Order cancellation        |
| `adjustment`| ±             | Manual stock adjustment   |

Fields: `previousStock`, `newStock`, `referenceId` (links to Order/PO),
`performedBy` (User ObjectId).

This gives a full timeline of every stock change, enabling auditing and
the 7-day stock graph on the dashboard.

---

## 5. Smart Low-Stock Alerts

**Naive alert:** fire when `variant.stock < lowStockThreshold`.

**Problem:** this creates noise when a Purchase Order is already on its way —
the manager doesn't need to order more if 200 units are inbound.

**Smart alert logic (`alertService.getSmartLowStockAlerts`):**

```
for each variant where stock < lowStockThreshold:
    pendingPOQty = sum of pending qty in POs with status IN
                  ["sent", "confirmed"] for this (productId, variantSku)
    effectiveStock = stock + pendingPOQty
    if effectiveStock >= lowStockThreshold:
        skip — the PO will replenish, no alert needed
    else:
        ALERT with severity = (stock === 0 ? "critical" : "warning")
```

This prevents false alarms while still catching cases where the inbound PO
is insufficient to cover the deficit.

**Key: the PO-map uses a composite key `${productId}::${variantSku}`**,
not just `variantSku`, to prevent collisions between different products
that share a SKU string.

---

## 6. Purchase Order Lifecycle

```
draft ──► sent ──► confirmed ──► received
                              └──► partially_received
          └──► cancelled (from any pre-received status)
```

- `draft` → `sent`: order is submitted to supplier
- `sent` → `confirmed`: supplier acknowledges
- `confirmed` → `received` / `partially_received`: goods arrive;
  each item records `receivedQuantity`, stock is incremented via
  `stockService.addStock()`, a `purchase` StockMovement is created
- `cancelled`: no stock changes; PO quantities are no longer counted in
  smart alerts

---

## 7. Sales Order Lifecycle

```
pending ──► confirmed ──► shipped ──► delivered
    └──────────────────────────────── cancelled
                                      (stock released)
```

- `pending`: stock is **atomically deducted** at creation time
- `cancelled`: `stockService.addStock()` releases the stock back,
  a `return` StockMovement is created for each undelivered item

---

## 8. RBAC (Role-Based Access Control)

Three roles: `owner (3) > manager (2) > staff (1)`

```js
// middleware/rbac.js
const ROLE_HIERARCHY = { owner: 3, manager: 2, staff: 1 };

const requireRole = (...allowed) => (req, res, next) => {
  if (ROLE_HIERARCHY[req.userRole] >= Math.min(...allowed.map(r => ROLE_HIERARCHY[r])))
    return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

const ownerOnly      = requireRole('owner');
const managerOrAbove = requireRole('manager', 'owner');
```

| Action                        | Minimum Role  |
|-------------------------------|---------------|
| View any resource             | staff         |
| Create/update products & POs  | manager       |
| Manage users                  | owner         |
| Delete/cancel items           | manager       |

---

## 9. Real-Time (Socket.io)

- Server maintains tenant rooms: each socket joins `tenant:{tenantId}` on connect.
- `emitToTenant(tenantId, event, data)` is called from `stockService` after
  every stock change.

| Event           | Trigger                               | Payload                            |
|-----------------|---------------------------------------|------------------------------------|
| `stock:updated` | Any stock change                      | `{ productId, sku, newStock }`     |
| `stock:low`     | After smart-alert check fires         | `{ variantSku, currentStock, threshold, severity, pendingPOQty }` |

- Client (`StockAlertListener.jsx`) subscribes and shows Ant Design
  `notification.warning()` / `notification.error()` in real time.
- Header shows a live connection-status indicator.

---

## 10. Dashboard Performance

The dashboard loads 4 endpoints in parallel (`Promise.all`) — all are designed
to run under 2 seconds for 10k+ products:

| Endpoint            | Strategy                                                      |
|---------------------|---------------------------------------------------------------|
| `/stats`            | `Product.aggregate` with `$unwind` + `$group` (single pass); `countDocuments` uses index scans |
| `/low-stock`        | `getSmartLowStockAlerts` — aggregates only active products below threshold |
| `/top-sellers`      | `StockMovement.aggregate` matching `{ tenantId, type:"sale", createdAt >= 30dAgo }` — uses `{ tenantId:1, type:1, createdAt:-1 }` index |
| `/stock-graph`      | `StockMovement.aggregate` with `$dateToString` grouping — uses `{ tenantId:1, createdAt:-1 }` index |

All aggregation `$match` stages use the leading `tenantId` key so MongoDB
performs an index scan, not a collection scan.

---

## 11. Key Design Trade-offs

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Tenancy | Row-level (`tenantId`) | Separate DB per tenant | Simpler ops, no connection explosion |
| Variant storage | Embedded in Product | Separate collection | Enables atomic `$elemMatch` update |
| Stock deduction | `findOneAndUpdate` + `$gte` guard | Optimistic locking | MongoDB native atomicity, no retry loop |
| Alerts | Smart (PO-aware) | Simple threshold | Reduces false alarm noise |
| Audit log | Append-only `StockMovement` | Update fields on Product | Full history, never lose data |
| Auth | Stateless JWT | Session/cookie | Scales horizontally, no server state |

---

## 12. File Structure

```
mern-assignment/
├── server/
│   ├── app.js                  — Express app, route mounting
│   ├── server.js               — HTTP + Socket.io bootstrap
│   ├── seed/seed.js            — 2 tenant seed (idempotent)
│   ├── scripts/testConcurrency.js
│   └── src/
│       ├── config/db.js
│       ├── middleware/
│       │   ├── auth.js         — JWT verify, injects req.tenantId
│       │   ├── rbac.js         — requireRole factory
│       │   └── errorHandler.js
│       ├── models/             — Tenant, User, Product, StockMovement,
│       │                         Supplier, PurchaseOrder, Order
│       ├── controllers/        — one file per resource
│       ├── services/
│       │   ├── stockService.js — atomic deduction + addStock
│       │   └── alertService.js — smart PO-aware alerts
│       └── socket/index.js     — Socket.io init + emitToTenant
└── client/
    └── src/
        ├── api/axios.js        — Axios + JWT interceptor
        ├── context/            — AuthContext, SocketContext
        ├── hooks/              — useAuth, useSocket
        ├── components/         — AppLayout, Sidebar, Header,
        │                         StockAlertListener, PrivateRoute
        └── pages/              — Dashboard, Products, Suppliers,
                                  PurchaseOrders, Orders, Inventory, Users
```
