# Multi-Tenant Inventory Management System

A full-stack MERN SaaS application that allows multiple independent businesses (tenants) to manage their inventory, suppliers, purchase orders, and sales — all with strict data isolation.

---

## Live Demo

| | Link |
|-|------|
| **Frontend** | [https://inventory-management-system-one-delta.vercel.app](https://inventory-management-system-one-delta.vercel.app) |
| **API Docs** | [https://inventory-api-gf22.onrender.com/api/docs](https://inventory-api-gf22.onrender.com/api/docs) |

> **Note:** The backend is hosted on Render's free tier and spins down after 15 minutes of inactivity. The first request after idle may take ~30 seconds to wake up.

---

## Deployment

| Layer | Platform | Notes |
|-------|----------|-------|
| Frontend | [Vercel](https://vercel.com) | Auto-deploys from `client/` on every push to `master` |
| Backend | [Render](https://render.com) | Auto-deploys from `server/` on every push to `master` |
| Database | [MongoDB Atlas M0](https://mongodb.com/cloud/atlas) | Free shared cluster |

---

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18, Vite, React Router, Ant Design 6, Recharts, Socket.io-client |
| Backend  | Node.js, Express 5, Socket.io                   |
| Database | MongoDB (Mongoose 9)                            |
| Auth     | JWT (stateless)                                 |

---

## Features

- **Multi-tenancy** — complete data isolation per business via `tenantId` row-level filtering
- **Product variants** — single product with multiple SKUs (size/colour/storage/etc.)
- **Concurrency-safe stock** — atomic `findOneAndUpdate` with MongoDB `$elemMatch` guard; no race conditions
- **Smart low-stock alerts** — only alerts when pending POs won't cover the deficit (no false alarms)
- **Purchase Order workflow** — draft → sent → confirmed → (partially) received, with per-item receipt tracking
- **Sales Order workflow** — atomic stock deduction on creation; partial fulfillment tracking; stock released on cancellation
- **Audit trail** — append-only `StockMovement` log for every stock change
- **Real-time notifications** — Socket.io pushes `stock:low` events to all users in the tenant room
- **Dashboard analytics** — inventory value, 7-day movement chart, top-5 sellers, low-stock widget
- **RBAC** — owner / manager / staff role hierarchy
- **API documentation** — full OpenAPI 3.0 spec served via Swagger UI at `/api/docs`

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone & install

```bash
git clone https://github.com/arnabbhakta791/inventory-management-system.git
cd inventory-management-system

# Install server deps
cd server && npm install

# Install client deps
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

This creates two isolated demo tenants with products, suppliers, purchase orders, sales orders, and stock movements.

### 4. Start servers

```bash
# Terminal 1 — API server (port 5000)
cd server && npm run dev

# Terminal 2 — React client (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173**

---

## API Documentation

| Environment | URL |
|-------------|-----|
| **Production** | [https://inventory-api-gf22.onrender.com/api/docs](https://inventory-api-gf22.onrender.com/api/docs) |
| **Local** | http://localhost:5000/api/docs |

### How to authenticate in Swagger UI

1. Open the Swagger UI URL above
2. Use **`POST /api/auth/login`** → click **Try it out** → enter a seed credential → **Execute**
3. Copy the `token` value from the response body
4. Click the **Authorize 🔒** button at the top of the page
5. Paste the token and click **Authorize** — all subsequent requests will include it automatically

> The token persists across page refreshes (`persistAuthorization: true`).

The spec covers all **34 endpoints** with full request/response schemas, role requirements, query parameters, and error response shapes (including the `409` insufficient-stock response with `sku`, `available`, and `requested` fields).

---

## Test Credentials

### TechStore (Electronics)

| Role    | Email                      | Password    |
|---------|----------------------------|-------------|
| Owner   | owner@techstore.com        | password123 |
| Manager | manager@techstore.com      | password123 |
| Staff   | staff@techstore.com        | password123 |

### FashionHub (Clothing)

| Role    | Email                      | Password    |
|---------|----------------------------|-------------|
| Owner   | owner@fashionhub.com       | password123 |
| Manager | manager@fashionhub.com     | password123 |
| Staff   | staff@fashionhub.com       | password123 |

> **Data isolation:** Login as a TechStore user and a FashionHub user simultaneously — each sees only their own data.

---

## API Endpoints

> Full interactive documentation with request/response schemas: **[https://inventory-api-gf22.onrender.com/api/docs](https://inventory-api-gf22.onrender.com/api/docs)**

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | public | Create tenant + owner |
| POST | `/api/auth/login` | public | Returns JWT |
| GET | `/api/auth/me` | any | Current user + tenant |
| GET/POST | `/api/users` | owner/manager | List / invite users |
| PATCH/DELETE | `/api/users/:id` | owner | Change role / deactivate |
| GET/POST | `/api/products` | any / manager | List / create products |
| GET/PUT/DELETE | `/api/products/:id` | any / manager | Get / update / soft-delete |
| PATCH | `/api/products/:id/restore` | manager | Restore a deactivated product |
| GET | `/api/products/low-stock` | any | Smart PO-aware alert list (`rawCount` + smart `count`) |
| GET | `/api/products/categories` | any | Distinct category list |
| PATCH | `/api/products/:id/variants/:sku/stock` | manager | Manual stock adjustment |
| GET/POST | `/api/suppliers` | any / manager | List / create suppliers |
| GET/PUT/DELETE | `/api/suppliers/:id` | any / manager | Get / update / delete supplier |
| GET/POST | `/api/purchase-orders` | any / manager | List / create POs |
| GET/PUT/DELETE | `/api/purchase-orders/:id` | any / manager | Get / update / cancel PO |
| PATCH | `/api/purchase-orders/:id/status` | manager | Status transition (draft→sent→confirmed) |
| POST | `/api/purchase-orders/:id/receive` | manager | Receive goods — partial delivery supported |
| GET/POST | `/api/orders` | any | List / create orders (atomic stock deduction) |
| GET | `/api/orders/:id` | any | Get single order |
| PATCH | `/api/orders/:id/status` | manager | Update order status |
| POST | `/api/orders/:id/cancel` | manager | Cancel + release unfulfilled stock |
| POST | `/api/orders/:id/fulfill` | manager | Record fulfillment batch (partial delivery supported) |
| GET | `/api/stock-movements` | any | Paginated append-only audit log |
| GET | `/api/stock-movements/product/:id/variant/:sku` | any | Variant-level movement history |
| GET | `/api/dashboard/stats` | any | KPI summary (inventory value, revenue, counts) |
| GET | `/api/dashboard/low-stock` | any | Smart low-stock alert list |
| GET | `/api/dashboard/top-sellers` | any | Top 5 selling variants — last 30 days |
| GET | `/api/dashboard/stock-graph` | any | Daily stock in/out — last 7 days |
| GET | `/api/health` | public | Server health check |

---

## Concurrency Test

```bash
cd server
npm run test:concurrency
```

Sets stock to 1 unit, fires 10 simultaneous POST `/api/orders` requests.  
**Expected:** exactly 1 success (HTTP 201) + 9 conflicts (HTTP 409).  
Confirms MongoDB atomic `$elemMatch` stock guard works correctly.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed design decisions and trade-offs.
