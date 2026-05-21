# Multi-Tenant Inventory Management System

A full-stack MERN SaaS application for managing inventory, suppliers, purchase orders, and sales across multiple isolated businesses (tenants).

**Live app:** https://inventory-management-system-one-delta.vercel.app
**API docs:** https://inventory-api-gf22.onrender.com/api/docs

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local) or a free [MongoDB Atlas](https://mongodb.com/cloud/atlas) M0 cluster

### 1. Clone & install

```bash
git clone https://github.com/arnabbhakta791/inventory-management-system.git
cd inventory-management-system

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
MONGO_URI=mongodb://localhost:27017/inventory-management
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
PORT=5000
```

### 3. Seed the database

```bash
cd server
npm run seed
```

Creates two fully isolated demo tenants — TechStore and FashionHub — each with products, variants, suppliers, purchase orders, sales orders, and stock movements.

### 4. Start servers

```bash
# Terminal 1 — API (port 5000)
cd server && npm run dev

# Terminal 2 — React client (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173**

---

## Test Credentials

### TechStore (Electronics)

| Role    | Email                   | Password    |
|---------|-------------------------|-------------|
| Owner   | owner@techstore.com     | password123 |
| Manager | manager@techstore.com   | password123 |
| Staff   | staff@techstore.com     | password123 |

### FashionHub (Clothing)

| Role    | Email                   | Password    |
|---------|-------------------------|-------------|
| Owner   | owner@fashionhub.com    | password123 |
| Manager | manager@fashionhub.com  | password123 |
| Staff   | staff@fashionhub.com    | password123 |

> Open two browser tabs and log in as a TechStore user and a FashionHub user simultaneously — each sees only their own data, confirming tenant isolation.

---

## Features Implemented

### Core
- **Multi-tenancy** — complete data isolation per business via `tenantId` on every document; enforced by middleware, not per-controller
- **RBAC** — owner / manager / staff role hierarchy; role checked centrally via middleware
- **JWT authentication** — stateless, 7-day expiry, attached to every API request via Axios interceptor

### Inventory
- **Product variants** — one product with multiple SKUs (size, colour, storage, etc.) stored as an embedded array
- **Soft delete & restore** — products are deactivated, not permanently deleted
- **Manual stock adjustment** — managers can correct stock counts with an audit reason
- **Smart low-stock alerts** — only flags variants where even pending Purchase Orders won't cover the deficit (no false alarms)

### Purchase Orders
- **Full PO workflow** — draft → sent → confirmed → received (with partial delivery support)
- **Per-item receipt tracking** — each line item tracks `receivedQuantity` independently
- **Stock auto-update on receive** — stock is incremented and a StockMovement is logged per item received

### Sales Orders
- **Atomic stock deduction** — uses `findOneAndUpdate` with `$elemMatch` guard; concurrent orders cannot oversell
- **Multi-item rollback** — if any item fails, previously deducted items are re-incremented (manual rollback, Atlas M0 has no transactions)
- **Partial fulfillment** — `POST /api/orders/:id/fulfill` records dispatch batches per SKU; auto-transitions to `delivered` or `partially_fulfilled`
- **Cancellation** — releases all unfulfilled stock back to inventory

### Audit & Real-time
- **Append-only stock movement log** — every stock change (purchase, sale, return, adjustment) is recorded with before/after quantities
- **Real-time notifications** — Socket.io pushes `stock:low` events to all users in the tenant room the moment stock drops below threshold

### Dashboard
- **Inventory value** — live total cost value across all active variant stock
- **Top 5 sellers** — last 30 days, ranked by units sold via aggregation pipeline
- **7-day stock graph** — daily stock in vs. out using `$dateToString` grouping in UTC
- **Low-stock widget** — PO-aware; same logic as the smart alert endpoint

### API & Docs
- **34 REST endpoints** — full OpenAPI 3.0 spec served via Swagger UI at `/api/docs`
- **Concurrency test script** — `npm run test:concurrency` fires 10 simultaneous orders against 1 unit of stock; expects exactly 1 success and 9 × 409

---

## Assumptions

- **One currency** — all prices are stored as plain numbers with no currency code; assumed single-currency per tenant.
- **No email delivery** — user invitations and low-stock alerts are in-app only; no SMTP integration.
- **No product images** — variants are text/attribute based; no file upload infrastructure.
- **Atlas M0 / no ACID transactions** — multi-item order atomicity is handled via manual rollback rather than a MongoDB session, as Atlas M0 does not support multi-document transactions.
- **UTC throughout** — all date boundaries in aggregation pipelines use `Date.UTC()` to avoid timezone-offset bugs; client display timezone is left to the browser.
- **Soft delete only for products** — suppliers, orders, and POs are never deleted; products can be deactivated and restored.
- **Seed data is idempotent** — running `npm run seed` more than once drops and recreates all seed data cleanly.

---

## Known Limitations

- **Render free-tier cold starts** — the backend spins down after 15 minutes of inactivity; the first request after idle takes ~30 seconds to wake up.
- **No email verification** — users can register with any email address; there is no verification step.
- **No refresh tokens** — JWT is stored in `localStorage`; a single 7-day token is issued with no silent refresh mechanism.
- **No pagination on a few sub-resources** — stock movement history per variant and PO status history are returned in full without pagination.
- **No image / file uploads** — product and supplier records are text-only.
- **Socket.io on free Render** — WebSocket connections may be interrupted during cold starts or Render's ~30-second request timeout; the client reconnects automatically but real-time events during that window are lost.
- **No automated test suite** — the only automated test is the concurrency script (`npm run test:concurrency`); no unit or integration tests exist.

---

## Verifying Real-Time Dashboard & Live Graph

The dashboard updates automatically via Socket.io — no page refresh needed. To see it in action:

### Quick test (two browser tabs)

1. **Tab 1 — Dashboard:** Log in as `owner@techstore.com` and stay on the Dashboard page.
2. **Tab 2 — Place an order:** Open a second tab, log in with the same (or any TechStore) account, go to **Sales Orders → New Order**, add an item, and click **Place Order**.
3. **Watch Tab 1:** The moment the order is placed, the Dashboard in Tab 1 will:
   - Update the **Inventory Value** and **Pending Orders** KPI cards instantly
   - Refresh the **7-day Stock Movement graph** (the "Stock Out" line rises for today)
   - Show a **low-stock notification toast** if the ordered item drops below its threshold
   - Update the **Low Stock Alerts** table (if applicable)

### Other actions that trigger live updates

| Action | Where | Dashboard effect |
|--------|-------|-----------------|
| Receive items on a Purchase Order | PO Detail → Receive Items | Stock In line rises; Inventory Value increases; low-stock alert may clear |
| Manual stock adjustment | Product → Edit → Adjust Stock | Graph and KPI cards update |
| Cancel an order | Order Detail → Cancel Order | Stock is released; Stock In line rises |

All updates flow through **Socket.io** — the server emits `stock:updated` after every stock change, and the Dashboard listens and re-fetches all widgets silently (you'll see the green "Live" badge next to the last-updated timestamp).

> **Note:** On the production Render free tier, the first request after inactivity wakes the server (~30s). Once awake, Socket.io connects and real-time updates work normally.

---

## Testing Concurrency (Atomic Stock Deduction)

The system protects against overselling using an atomic `findOneAndUpdate` with a `$gte` stock guard. To prove it works:

### Prerequisites
- Server must be running locally (`cd server && npm run dev`)
- Seed data must be loaded (`npm run seed`)

### Run the test

```bash
cd server
npm run test:concurrency
```

### What it does

1. Logs in as the TechStore owner to get a JWT
2. Picks a product variant and **sets its stock to exactly 1 unit**
3. Fires **10 simultaneous** `POST /api/orders` requests, each requesting qty = 1
4. Collects all responses and checks the database

### Expected output

```
═══ Concurrency Test: Atomic Stock Deduction ═══

✓ Connected to MongoDB
✓ Logged in as: TechStore Owner (TechStore)
✓ Set stock for SKU "IPHONE-15-128GB-BLACK" → 1 unit

→ Firing 10 simultaneous orders for qty=1 of "IPHONE-15-128GB-BLACK"...

─── Results ───────────────────────────────────────
  Total requests  : 10
  Time elapsed    : ~50ms
  ✓ Successes (201): 1   ← exactly one order wins
  ✗ Conflicts (409): 9   ← the rest get "Insufficient stock"

─── DB Verification ────────────────────────────────
  Final stock: 0  (never negative — no overselling)

─── Verdict ────────────────────────────────────────
  ✓ TEST PASSED — Concurrency protection works correctly!
```

The key proof: **exactly 1 success, 9 rejections, and stock is 0 (not negative)**. No matter how many concurrent requests hit the server, MongoDB's atomic update ensures only one can claim the last unit.

> The script exits with code `0` on pass and `1` on fail, so it can be used in CI pipelines.

---

## Deployment

| Layer | Platform | Live URL |
|-------|----------|----------|
| Frontend | Vercel | https://inventory-management-system-one-delta.vercel.app |
| Backend | Render | https://inventory-api-gf22.onrender.com |
| Database | MongoDB Atlas M0 | Shared free cluster |

Both Vercel and Render are connected to this GitHub repository and **auto-deploy on every push to `master`**. Deploying a new feature is just:

```bash
git add .
git commit -m "feat: your change"
git push origin master
```

- **Vercel** picks up the push, rebuilds the React app, and serves the new version within ~1 minute.
- **Render** picks up the push, runs `npm install`, restarts the Node server, and is live within ~2 minutes.

No manual steps, no CLI tools, no SSH — the push is the deploy.

> **Render free-tier note:** The backend spins down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to wake up.

---

## API Documentation

| Environment | URL |
|-------------|-----|
| **Production** | https://inventory-api-gf22.onrender.com/api/docs |
| **Local** | http://localhost:5000/api/docs |

The interactive Swagger UI documents all **34 endpoints** with full request/response schemas, role requirements, query parameters, and error shapes.

### How to authenticate in Swagger UI

1. Open the Swagger UI URL
2. Use **`POST /api/auth/login`** → click **Try it out** → enter a seed credential → **Execute**
3. Copy the `token` value from the response body
4. Click the **Authorize 🔒** button at the top right
5. Paste the token → click **Authorize**

All subsequent requests in the UI will include the token automatically. The token persists across page refreshes (`persistAuthorization: true`).

The server dropdown at the top of the page lists both the production server and localhost — select the one matching your environment.
