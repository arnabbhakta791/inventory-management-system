/**
 * OpenAPI 3.0 specification for the Multi-Tenant Inventory Management API.
 * Served at GET /api/docs via swagger-ui-express.
 */

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Multi-Tenant Inventory Management API',
    version: '1.0.0',
    description: `
## Overview
A multi-tenant SaaS inventory management system. Each tenant (business) has
fully isolated data. All protected endpoints require a **Bearer JWT** token.

## Authentication
1. Register a new tenant via \`POST /api/auth/register\` — returns a JWT.
2. Or log in via \`POST /api/auth/login\`.
3. Click **Authorize** above and paste: \`Bearer <your_token>\`.

## Roles
| Role | Level | Permissions |
|------|-------|-------------|
| \`owner\` | 3 | Full access including user management |
| \`manager\` | 2 | All except inviting/changing user roles |
| \`staff\` | 1 | Read-only on most resources |

## Seed Credentials
| Tenant | Email | Password | Role |
|--------|-------|----------|------|
| TechStore | owner@techstore.com | password123 | owner |
| TechStore | manager@techstore.com | password123 | manager |
| TechStore | staff@techstore.com | password123 | staff |
| FashionHub | owner@fashionhub.com | password123 | owner |
    `,
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local development server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token (without the Bearer prefix — the UI adds it)',
      },
    },
    schemas: {
      // ── Shared primitives ────────────────────────────────────────────────
      ObjectId: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$',
        example: '64a1f2b3c4d5e6f7a8b9c0d1',
      },
      Pagination: {
        type: 'object',
        properties: {
          page:  { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          pages: { type: 'integer', example: 3 },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Resource not found' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field:   { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },

      // ── Auth ────────────────────────────────────────────────────────────
      RegisterRequest: {
        type: 'object',
        required: ['tenantName', 'name', 'email', 'password'],
        properties: {
          tenantName: { type: 'string', example: 'My Store' },
          name:       { type: 'string', example: 'John Doe' },
          email:      { type: 'string', format: 'email', example: 'john@mystore.com' },
          password:   { type: 'string', minLength: 6, example: 'secret123' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', example: 'owner@techstore.com' },
          password: { type: 'string', example: 'password123' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token:   { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              _id:      { $ref: '#/components/schemas/ObjectId' },
              name:     { type: 'string', example: 'John Doe' },
              email:    { type: 'string', example: 'john@mystore.com' },
              role:     { type: 'string', enum: ['owner', 'manager', 'staff'] },
              tenantId: { $ref: '#/components/schemas/ObjectId' },
            },
          },
        },
      },

      // ── Product ─────────────────────────────────────────────────────────
      ProductVariant: {
        type: 'object',
        required: ['sku', 'costPrice', 'sellingPrice'],
        properties: {
          sku:               { type: 'string', example: 'TSHIRT-M-RED' },
          attributes:        { type: 'object', additionalProperties: { type: 'string' }, example: { size: 'M', color: 'Red' } },
          stock:             { type: 'integer', minimum: 0, example: 50 },
          reservedStock:     { type: 'integer', minimum: 0, example: 5 },
          costPrice:         { type: 'number', minimum: 0, example: 299.99 },
          sellingPrice:      { type: 'number', minimum: 0, example: 599.99 },
          lowStockThreshold: { type: 'integer', minimum: 0, example: 10 },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id:        { $ref: '#/components/schemas/ObjectId' },
          name:       { type: 'string', example: 'Classic T-Shirt' },
          description:{ type: 'string' },
          category:   { type: 'string', example: 'Apparel' },
          brand:      { type: 'string', example: 'BrandX' },
          supplierId: { type: 'object', properties: { _id: { $ref: '#/components/schemas/ObjectId' }, name: { type: 'string' } } },
          attributes: { type: 'array', items: { type: 'string' }, example: ['size', 'color'] },
          variants:   { type: 'array', items: { $ref: '#/components/schemas/ProductVariant' } },
          isActive:   { type: 'boolean', example: true },
          createdAt:  { type: 'string', format: 'date-time' },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'category', 'variants'],
        properties: {
          name:        { type: 'string', example: 'Classic T-Shirt' },
          description: { type: 'string' },
          category:    { type: 'string', example: 'Apparel' },
          brand:       { type: 'string', example: 'BrandX' },
          supplierId:  { $ref: '#/components/schemas/ObjectId' },
          attributes:  { type: 'array', items: { type: 'string' }, example: ['size', 'color'] },
          variants:    { type: 'array', minItems: 1, items: { $ref: '#/components/schemas/ProductVariant' } },
        },
      },

      // ── Supplier ─────────────────────────────────────────────────────────
      Supplier: {
        type: 'object',
        properties: {
          _id:           { $ref: '#/components/schemas/ObjectId' },
          name:          { type: 'string', example: 'Global Supplies Ltd.' },
          email:         { type: 'string', format: 'email' },
          phone:         { type: 'string' },
          address:       { type: 'string' },
          contactPerson: { type: 'string' },
          isActive:      { type: 'boolean' },
          createdAt:     { type: 'string', format: 'date-time' },
        },
      },
      CreateSupplierRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name:          { type: 'string', example: 'Global Supplies Ltd.' },
          email:         { type: 'string', format: 'email', example: 'contact@globalsupplies.com' },
          phone:         { type: 'string', example: '+91-9876543210' },
          address:       { type: 'string' },
          contactPerson: { type: 'string' },
        },
      },

      // ── Purchase Order ───────────────────────────────────────────────────
      POItem: {
        type: 'object',
        required: ['productId', 'variantSku', 'quantity', 'unitPrice'],
        properties: {
          productId:        { $ref: '#/components/schemas/ObjectId' },
          variantSku:       { type: 'string', example: 'TSHIRT-M-RED' },
          productName:      { type: 'string' },
          quantity:         { type: 'integer', minimum: 1, example: 100 },
          unitPrice:        { type: 'number', minimum: 0, example: 299.99 },
          receivedQuantity: { type: 'integer', minimum: 0, example: 0 },
        },
      },
      PurchaseOrder: {
        type: 'object',
        properties: {
          _id:                  { $ref: '#/components/schemas/ObjectId' },
          orderNumber:          { type: 'string', example: 'PO-TECHSTORE-0001' },
          supplierId:           { type: 'object', properties: { _id: { $ref: '#/components/schemas/ObjectId' }, name: { type: 'string' } } },
          status:               { type: 'string', enum: ['draft', 'sent', 'confirmed', 'received', 'partially_received', 'cancelled'] },
          items:                { type: 'array', items: { $ref: '#/components/schemas/POItem' } },
          totalAmount:          { type: 'number', example: 29999 },
          expectedDeliveryDate: { type: 'string', format: 'date' },
          notes:                { type: 'string' },
          createdAt:            { type: 'string', format: 'date-time' },
        },
      },
      CreatePORequest: {
        type: 'object',
        required: ['supplierId', 'items'],
        properties: {
          supplierId:           { $ref: '#/components/schemas/ObjectId' },
          items:                { type: 'array', minItems: 1, items: { $ref: '#/components/schemas/POItem' } },
          expectedDeliveryDate: { type: 'string', format: 'date', example: '2025-07-01' },
          notes:                { type: 'string' },
        },
      },
      ReceivePORequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['variantSku', 'receivedQuantity'],
              properties: {
                variantSku:       { type: 'string', example: 'TSHIRT-M-RED' },
                receivedQuantity: { type: 'integer', minimum: 0, example: 50 },
              },
            },
          },
        },
      },

      // ── Order ────────────────────────────────────────────────────────────
      OrderItem: {
        type: 'object',
        required: ['productId', 'variantSku', 'quantity'],
        properties: {
          productId:         { $ref: '#/components/schemas/ObjectId' },
          variantSku:        { type: 'string', example: 'TSHIRT-M-RED' },
          productName:       { type: 'string' },
          quantity:          { type: 'integer', minimum: 1, example: 2 },
          unitPrice:         { type: 'number', example: 599.99 },
          fulfilledQuantity: { type: 'integer', minimum: 0, example: 0 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          _id:          { $ref: '#/components/schemas/ObjectId' },
          orderNumber:  { type: 'string', example: 'ORD-TECHSTORE-250521-AB12' },
          customerName: { type: 'string', example: 'Jane Smith' },
          customerEmail:{ type: 'string', format: 'email' },
          customerPhone:{ type: 'string' },
          status:       { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'partially_fulfilled'] },
          items:        { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          totalAmount:  { type: 'number', example: 1199.98 },
          notes:        { type: 'string' },
          createdAt:    { type: 'string', format: 'date-time' },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['customerName', 'items'],
        properties: {
          customerName:  { type: 'string', example: 'Jane Smith' },
          customerEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
          customerPhone: { type: 'string', example: '+91-9876543210' },
          notes:         { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'variantSku', 'quantity'],
              properties: {
                productId:  { $ref: '#/components/schemas/ObjectId' },
                variantSku: { type: 'string', example: 'TSHIRT-M-RED' },
                quantity:   { type: 'integer', minimum: 1, example: 2 },
                unitPrice:  { type: 'number', description: 'Overrides the product selling price if provided' },
              },
            },
          },
        },
      },
      FulfillOrderRequest: {
        type: 'object',
        required: ['items'],
        description: 'Record a fulfillment batch. `quantity` is units dispatched NOW, not cumulative.',
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['variantSku', 'quantity'],
              properties: {
                variantSku: { type: 'string', example: 'TSHIRT-M-RED' },
                quantity:   { type: 'integer', minimum: 1, example: 1 },
              },
            },
          },
        },
      },

      // ── Stock Movement ───────────────────────────────────────────────────
      StockMovement: {
        type: 'object',
        properties: {
          _id:           { $ref: '#/components/schemas/ObjectId' },
          productId:     { $ref: '#/components/schemas/ObjectId' },
          variantSku:    { type: 'string' },
          type:          { type: 'string', enum: ['purchase', 'sale', 'return', 'adjustment'] },
          quantity:      { type: 'number', description: 'Positive = stock in, negative = stock out' },
          previousStock: { type: 'integer' },
          newStock:      { type: 'integer' },
          reference:     { type: 'string', description: 'Order number or PO number' },
          notes:         { type: 'string' },
          performedBy:   { type: 'object', properties: { _id: { $ref: '#/components/schemas/ObjectId' }, name: { type: 'string' } } },
          createdAt:     { type: 'string', format: 'date-time' },
        },
      },

      // ── User ─────────────────────────────────────────────────────────────
      User: {
        type: 'object',
        properties: {
          _id:      { $ref: '#/components/schemas/ObjectId' },
          name:     { type: 'string' },
          email:    { type: 'string', format: 'email' },
          role:     { type: 'string', enum: ['owner', 'manager', 'staff'] },
          isActive: { type: 'boolean' },
        },
      },

      // ── Low Stock Alert ───────────────────────────────────────────────────
      LowStockAlert: {
        type: 'object',
        properties: {
          productId:     { $ref: '#/components/schemas/ObjectId' },
          productName:   { type: 'string' },
          category:      { type: 'string' },
          supplier:      { type: 'string', nullable: true },
          sku:           { type: 'string' },
          currentStock:  { type: 'integer' },
          pendingPOQty:  { type: 'integer', description: 'Units inbound from sent/confirmed POs' },
          effectiveStock:{ type: 'integer', description: 'currentStock + pendingPOQty' },
          threshold:     { type: 'integer' },
          deficit:       { type: 'integer', description: 'threshold - effectiveStock' },
          severity:      { type: 'string', enum: ['critical', 'warning'] },
        },
      },
    },

    // ── Reusable responses ─────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: 'Missing or invalid JWT token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient role',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
      },
    },

    // ── Reusable parameters ────────────────────────────────────────────────
    parameters: {
      idParam: {
        name: 'id', in: 'path', required: true,
        schema: { $ref: '#/components/schemas/ObjectId' },
      },
      pageParam:  { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 } },
      limitParam: { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
    },
  },

  // Global security — all routes use Bearer JWT unless overridden
  security: [{ bearerAuth: [] }],

  tags: [
    { name: 'Auth',             description: 'Registration, login, and current-user' },
    { name: 'Products',         description: 'Product & variant management, stock adjustments' },
    { name: 'Suppliers',        description: 'Supplier CRUD' },
    { name: 'Purchase Orders',  description: 'PO lifecycle — draft → sent → confirmed → received' },
    { name: 'Orders',           description: 'Sales order lifecycle with atomic stock deduction' },
    { name: 'Stock Movements',  description: 'Append-only audit log of all stock changes' },
    { name: 'Dashboard',        description: 'Aggregated KPIs, charts, and smart alerts' },
    { name: 'Users',            description: 'Tenant user management (owner only for mutations)' },
  ],

  paths: {
    // ════════════════════════════════════════════════════════════
    // AUTH
    // ════════════════════════════════════════════════════════════
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new tenant and owner account',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          201: { description: 'Tenant created, JWT returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the currently authenticated user and their tenant',
        responses: {
          200: {
            description: 'Current user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user:   { $ref: '#/components/schemas/User' },
                        tenant: { type: 'object', properties: { _id: { $ref: '#/components/schemas/ObjectId' }, name: { type: 'string' }, slug: { type: 'string' } } },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // PRODUCTS
    // ════════════════════════════════════════════════════════════
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (paginated, filterable)',
        parameters: [
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
          { name: 'search',     in: 'query', schema: { type: 'string' },  description: 'Full-text search on name, brand, tags' },
          { name: 'category',   in: 'query', schema: { type: 'string' } },
          { name: 'supplierId', in: 'query', schema: { type: 'string' } },
          { name: 'isActive',   in: 'query', schema: { type: 'string', enum: ['true', 'false', 'all'], default: 'true' } },
          { name: 'lowStock',   in: 'query', schema: { type: 'string', enum: ['true'] }, description: 'Filter to products with any variant below threshold' },
        ],
        responses: {
          200: {
            description: 'Paginated product list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:    { type: 'boolean' },
                    data:       { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product with variants (manager/owner)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } } } },
        responses: {
          201: { description: 'Product created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Product' } } } } } },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/products/low-stock': {
      get: {
        tags: ['Products'],
        summary: 'Smart low-stock alerts (PO-aware)',
        description: 'Returns variants where `effectiveStock = stock + pendingPOQty < lowStockThreshold`. Also returns `rawCount` (all products below threshold regardless of PO coverage) for the product-list badge.',
        responses: {
          200: {
            description: 'Low-stock alerts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:  { type: 'boolean' },
                    data:     { type: 'array', items: { $ref: '#/components/schemas/LowStockAlert' } },
                    count:    { type: 'integer', description: 'Smart count — variants still needing action' },
                    rawCount: { type: 'integer', description: 'Raw count — products with any variant below threshold (includes PO-covered)' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/products/categories': {
      get: {
        tags: ['Products'],
        summary: 'List all distinct active product categories for this tenant',
        responses: {
          200: { description: 'Category list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'string' } } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get a single product with all variants',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Product', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Product' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update a product (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } } } },
        responses: {
          200: { description: 'Updated product' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Soft-delete (deactivate) a product (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Product deactivated' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/products/{id}/restore': {
      patch: {
        tags: ['Products'],
        summary: 'Restore (reactivate) a deactivated product (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Product restored', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/Product' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/products/{id}/variants/{sku}/stock': {
      patch: {
        tags: ['Products'],
        summary: 'Manual stock adjustment for a variant (manager/owner)',
        description: 'Positive `adjustment` adds stock, negative removes it. Cannot go below 0. Creates a StockMovement audit record and emits a real-time socket event.',
        parameters: [
          { $ref: '#/components/parameters/idParam' },
          { name: 'sku', in: 'path', required: true, schema: { type: 'string' }, example: 'TSHIRT-M-RED' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['adjustment'],
                properties: {
                  adjustment: { type: 'number', example: -5, description: 'Units to add (positive) or remove (negative)' },
                  notes:      { type: 'string', example: 'Damaged goods removed' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated product' },
          400: { description: 'Stock would go below 0' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // SUPPLIERS
    // ════════════════════════════════════════════════════════════
    '/api/suppliers': {
      get: {
        tags: ['Suppliers'],
        summary: 'List all suppliers for this tenant',
        parameters: [
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Supplier list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Supplier' } } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Suppliers'],
        summary: 'Create a supplier (manager/owner)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSupplierRequest' } } } },
        responses: {
          201: { description: 'Supplier created' },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/suppliers/{id}': {
      get: {
        tags: ['Suppliers'],
        summary: 'Get a single supplier',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Supplier' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Suppliers'],
        summary: 'Update a supplier (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSupplierRequest' } } } },
        responses: {
          200: { description: 'Updated supplier' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Suppliers'],
        summary: 'Delete a supplier (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Supplier deleted' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // PURCHASE ORDERS
    // ════════════════════════════════════════════════════════════
    '/api/purchase-orders': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'List purchase orders (paginated, filterable)',
        parameters: [
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
          { name: 'status',     in: 'query', schema: { type: 'string', enum: ['draft', 'sent', 'confirmed', 'received', 'partially_received', 'cancelled'] } },
          { name: 'supplierId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'PO list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/PurchaseOrder' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Purchase Orders'],
        summary: 'Create a draft Purchase Order (manager/owner)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePORequest' } } } },
        responses: {
          201: { description: 'Draft PO created' },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/purchase-orders/{id}': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'Get a single Purchase Order',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Purchase Order' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Purchase Orders'],
        summary: 'Update a draft PO (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePORequest' } } } },
        responses: {
          200: { description: 'Updated PO' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Purchase Orders'],
        summary: 'Cancel a PO (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'PO cancelled' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/purchase-orders/{id}/status': {
      patch: {
        tags: ['Purchase Orders'],
        summary: 'Transition PO status (manager/owner)',
        description: 'Allowed transitions: `draft→sent`, `sent→confirmed`, `confirmed→received`, any non-received → `cancelled`.',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['sent', 'confirmed', 'received', 'cancelled'] },
                  notes:  { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          400: { description: 'Invalid status transition' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/purchase-orders/{id}/receive': {
      post: {
        tags: ['Purchase Orders'],
        summary: 'Receive items from a PO — supports partial delivery (manager/owner)',
        description: 'Updates `receivedQuantity` per item, increments product stock, creates `purchase` StockMovements. Status auto-transitions to `partially_received` or `received`.',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReceivePORequest' } } } },
        responses: {
          200: { description: 'Items received, stock updated' },
          400: { description: 'Received quantity exceeds ordered quantity' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // ORDERS (SALES)
    // ════════════════════════════════════════════════════════════
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List sales orders (paginated, filterable)',
        parameters: [
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
          { name: 'status',   in: 'query', schema: { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'partially_fulfilled'] } },
          { name: 'search',   in: 'query', schema: { type: 'string' }, description: 'Customer name search' },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo',   in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Order list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Order' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create a sales order — atomically deducts stock',
        description: 'Stock is deducted immediately using a `findOneAndUpdate` guard (`stock ≥ qty`). If two simultaneous requests compete for the last unit, exactly one succeeds (HTTP 201) and the other gets HTTP 409.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderRequest' } } } },
        responses: {
          201: { description: 'Order created, stock deducted' },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          409: {
            description: 'Insufficient stock — includes which SKU failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:   { type: 'boolean', example: false },
                    message:   { type: 'string', example: 'Insufficient stock for SKU "TSHIRT-M-RED": available=0, requested=2' },
                    sku:       { type: 'string' },
                    available: { type: 'integer' },
                    requested: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get a single order',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Order' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Transition order status (manager/owner)',
        description: 'Allowed transitions: `pending→confirmed`, `confirmed→shipped`, `shipped→delivered`, any non-delivered/non-cancelled → `cancelled` (releases unfulfilled stock).',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['confirmed', 'shipped', 'delivered', 'cancelled'] },
                  notes:  { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          400: { description: 'Invalid transition' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel an order and release unfulfilled stock (manager/owner)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'Order cancelled, unfulfilled stock released' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/orders/{id}/fulfill': {
      post: {
        tags: ['Orders'],
        summary: 'Record a fulfillment batch — supports partial delivery (manager/owner)',
        description: 'Each call records units dispatched in THIS batch (not cumulative). Auto-transitions: all items fulfilled → `delivered`, some remaining → `partially_fulfilled`. Stock is NOT changed (already deducted at order creation).',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FulfillOrderRequest' } } } },
        responses: {
          200: { description: 'Fulfillment recorded, order status updated' },
          400: { description: 'Quantity exceeds remaining unfulfilled amount' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // STOCK MOVEMENTS
    // ════════════════════════════════════════════════════════════
    '/api/stock-movements': {
      get: {
        tags: ['Stock Movements'],
        summary: 'List stock movements (append-only audit log)',
        parameters: [
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
          { name: 'type',       in: 'query', schema: { type: 'string', enum: ['purchase', 'sale', 'return', 'adjustment'] } },
          { name: 'productId',  in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom',   in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo',     in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Movement log', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/StockMovement' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/stock-movements/product/{productId}/variant/{sku}': {
      get: {
        tags: ['Stock Movements'],
        summary: 'Get movement history for a specific product variant',
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { $ref: '#/components/schemas/ObjectId' } },
          { name: 'sku',       in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/pageParam' },
          { $ref: '#/components/parameters/limitParam' },
        ],
        responses: {
          200: { description: 'Variant movement history' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // DASHBOARD
    // ════════════════════════════════════════════════════════════
    '/api/dashboard/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Summary KPIs — total products, orders, stock value, revenue',
        responses: {
          200: {
            description: 'Dashboard stats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        totalProducts:    { type: 'integer' },
                        totalOrders:      { type: 'integer' },
                        totalInventoryValue: { type: 'number', description: 'Sum of (costPrice × stock) across all active variants' },
                        totalRevenue:     { type: 'number', description: 'Sum of totalAmount for delivered orders' },
                        lowStockCount:    { type: 'integer' },
                        pendingOrders:    { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/dashboard/low-stock': {
      get: {
        tags: ['Dashboard'],
        summary: 'Smart low-stock alert list for the dashboard (PO-aware)',
        responses: {
          200: { description: 'Alert list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/LowStockAlert' } } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/dashboard/top-sellers': {
      get: {
        tags: ['Dashboard'],
        summary: 'Top 5 selling variants in the last 30 days',
        responses: {
          200: {
            description: 'Top sellers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sku:         { type: 'string' },
                          productName: { type: 'string' },
                          totalSold:   { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/dashboard/stock-graph': {
      get: {
        tags: ['Dashboard'],
        summary: 'Daily net stock movement for the last 7 days',
        responses: {
          200: {
            description: 'Stock graph data points',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date:     { type: 'string', format: 'date', example: '2025-05-20' },
                          stockIn:  { type: 'integer' },
                          stockOut: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // USERS
    // ════════════════════════════════════════════════════════════
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users in this tenant (manager/owner)',
        responses: {
          200: { description: 'User list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Invite a new user to this tenant (owner only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'role'],
                properties: {
                  name:     { type: 'string', example: 'Alice' },
                  email:    { type: 'string', format: 'email', example: 'alice@techstore.com' },
                  password: { type: 'string', minLength: 6, example: 'password123' },
                  role:     { type: 'string', enum: ['manager', 'staff'], example: 'staff' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
          400: { description: 'Email already in use' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Update a user role or status (owner only)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role:     { type: 'string', enum: ['manager', 'staff'] },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Deactivate a user (owner only)',
        parameters: [{ $ref: '#/components/parameters/idParam' }],
        responses: {
          200: { description: 'User deactivated' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ════════════════════════════════════════════════════════════
    // HEALTH
    // ════════════════════════════════════════════════════════════
    '/api/health': {
      get: {
        tags: ['Auth'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Server is up',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string', format: 'date-time' } } } } },
          },
        },
      },
    },
  },
};

module.exports = swaggerDefinition;
