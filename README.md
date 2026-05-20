# Multi-Tenant Inventory Management System

A full-stack MERN SaaS application that allows multiple independent businesses (tenants) to manage their inventory, suppliers, purchase orders, and sales — all with strict data isolation.

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
- **Sales Order workflow** — atomic stock deduction on creation; stock released on cancellation
- **Audit trail** — append-only `StockMovement` log for every stock change
- **Real-time notifications** — Socket.io pushes `stock:low` events to all users in the tenant room
- **Dashboard analytics** — inventory value, 7-day movement chart, top-5 sellers, low-stock widget
- **RBAC** — owner / manager / staff role hierarchy

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

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | public | Create tenant + owner |
| POST | `/api/auth/login` | public | Returns JWT |
| GET | `/api/auth/me` | any | Current user + tenant |
| GET/POST | `/api/users` | owner/manager | List / invite users |
| PATCH/DELETE | `/api/users/:id` | owner | Change role / deactivate |
| GET/POST | `/api/products` | any / manager | List / create products |
| PUT/DELETE | `/api/products/:id` | manager | Update / soft-delete |
| PATCH | `/api/products/:id/variants/:sku/stock` | manager | Manual stock adjustment |
| CRUD | `/api/suppliers` | manager | Supplier management |
| GET/POST | `/api/purchase-orders` | any / manager | List / create POs |
| PATCH | `/api/purchase-orders/:id/status` | manager | Status transition |
| POST | `/api/purchase-orders/:id/receive` | manager | Receive goods (partial ok) |
| GET/POST | `/api/orders` | any | List / create orders (atomic stock) |
| PATCH | `/api/orders/:id/status` | manager | Update order status |
| POST | `/api/orders/:id/cancel` | manager | Cancel + release stock |
| GET | `/api/stock-movements` | any | Paginated audit log |
| GET | `/api/dashboard/stats` | any | KPI summary |
| GET | `/api/dashboard/low-stock` | any | Smart alert list |
| GET | `/api/dashboard/top-sellers` | any | Top 5 last 30 days |
| GET | `/api/dashboard/stock-graph` | any | Daily movements last 7 days |

---

## Concurrency Test

```bash
cd server
npm run test:concurrency
```

Sets stock to 1 unit, fires 10 simultaneous POST `/api/orders` requests.  
**Expected:** exactly 1 success (HTTP 201) + 9 conflicts (HTTP 409).  
Confirms MongoDB atomic `$elemMatch` stock guard works correctly.

---

## Project Structure

```
mern-assignment/
├── server/
│   ├── app.js
│   ├── server.js
│   ├── seed/seed.js
│   ├── scripts/testConcurrency.js
│   └── src/
│       ├── config/db.js
│       ├── middleware/      auth, rbac, errorHandler
│       ├── models/          Tenant, User, Product, StockMovement,
│       │                    Supplier, PurchaseOrder, Order
│       ├── controllers/     one per resource
│       ├── services/        stockService, alertService
│       └── socket/index.js
├── client/
│   └── src/
│       ├── api/axios.js
│       ├── context/         AuthContext, SocketContext
│       ├── hooks/           useAuth, useSocket
│       ├── components/      Layout, StockAlertListener, PrivateRoute
│       └── pages/           Dashboard, Products, Suppliers,
│                            PurchaseOrders, Orders, Inventory, Users
├── ARCHITECTURE.md
└── README.md
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed design decisions and trade-offs.
