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

## Time Breakdown

| Area | Time |
|------|------|
| Project setup — Express, Vite, folder structure, env, CORS, helmet | 1 h |
| Auth — register, login, JWT middleware, tenant isolation middleware, RBAC | 2 h |
| Product model + CRUD API (variants, soft delete, categories, restore) | 2.5 h |
| Stock service — atomic deduction, manual adjustment, StockMovement audit log | 2 h |
| Supplier model + CRUD API | 1 h |
| Purchase Order model, workflow, partial receive, stock update on receive | 3 h |
| Sales Order model, concurrent-safe creation, cancellation, partial fulfillment | 3 h |
| Smart low-stock alert logic (PO-aware filtering) | 1 h |
| Dashboard analytics API — 4 aggregation pipelines, index design | 2 h |
| Socket.io — server rooms, `stock:low` emit, client context + notifications | 1.5 h |
| User management API + frontend page | 1.5 h |
| Seed script — 2 tenants, realistic relational data, idempotent | 2 h |
| Frontend — all pages (products, suppliers, POs, orders, inventory, dashboard) | 8 h |
| Auth UI — split-panel layout, slide animation, glassmorphism dashboard mockup | 3 h |
| Swagger / OpenAPI 3.0 spec — 34 endpoints, all schemas | 2 h |
| Deployment — MongoDB Atlas, Render, Vercel, env wiring | 1 h |
| Debugging, polish, README, ARCHITECTURE.md | 2 h |
| **Total** | **~38 h** |
