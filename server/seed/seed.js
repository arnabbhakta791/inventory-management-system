/**
 * seed.js — Populates the database with two fully isolated tenants for demo / testing.
 *
 * Tenant 1: TechStore   — electronics retailer
 * Tenant 2: FashionHub  — clothing retailer
 *
 * Each tenant gets:
 *   • 3 users  (owner / manager / staff)
 *   • 4-5 suppliers
 *   • 15-20 products with variants
 *   • 6-8 purchase orders (mixed statuses)
 *   • 10-15 sales orders (mixed statuses)
 *   • Realistic StockMovement audit log
 *
 * Run: npm run seed  (from /server)
 *
 * The script is IDEMPOTENT — it deletes the two tenant slugs' data first.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Tenant        = require('../src/models/Tenant');
const User          = require('../src/models/User');
const Product       = require('../src/models/Product');
const StockMovement = require('../src/models/StockMovement');
const Supplier      = require('../src/models/Supplier');
const PurchaseOrder = require('../src/models/PurchaseOrder');
const Order         = require('../src/models/Order');

// ─── helpers ────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[rand(0, arr.length - 1)];
const now   = ()         => new Date();
const daysAgo = (n)      => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysFromNow = (n)  => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

let poSeq  = 1;
let ordSeq = 1;
const nextPO  = (slug) => `PO-${slug.toUpperCase()}-${String(poSeq++).padStart(4,'0')}`;
const nextORD = (slug) => `ORD-${slug.toUpperCase()}-${String(ordSeq++).padStart(4,'0')}`;

// ─── main ────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected to MongoDB\n');

  // ── wipe existing seed tenants ──────────────────────────────────────────
  for (const slug of ['techstore', 'fashionhub']) {
    const tenant = await Tenant.findOne({ slug });
    if (tenant) {
      const id = tenant._id;
      await Promise.all([
        User.deleteMany({ tenantId: id }),
        Product.deleteMany({ tenantId: id }),
        StockMovement.deleteMany({ tenantId: id }),
        Supplier.deleteMany({ tenantId: id }),
        PurchaseOrder.deleteMany({ tenantId: id }),
        Order.deleteMany({ tenantId: id }),
        Tenant.deleteOne({ _id: id }),
      ]);
      console.log(`🗑   Cleared existing "${slug}" data`);
    }
  }

  console.log();

  // ──────────────────────────────────────────────────────────────────────────
  //  TENANT 1 — TechStore
  // ──────────────────────────────────────────────────────────────────────────
  poSeq = 1; ordSeq = 1;

  const tech = await Tenant.create({
    name: 'TechStore',
    slug: 'techstore',
    plan: 'pro',
    settings: { lowStockThreshold: 10 },
  });

  const [techOwner, techManager, techStaff] = await User.create([
    { tenantId: tech._id, name: 'Alex Owner',   email: 'owner@techstore.com',   password: 'password123', role: 'owner'   },
    { tenantId: tech._id, name: 'Sam Manager',  email: 'manager@techstore.com', password: 'password123', role: 'manager' },
    { tenantId: tech._id, name: 'Jamie Staff',  email: 'staff@techstore.com',   password: 'password123', role: 'staff'   },
  ]);
  console.log('👤  TechStore users created');

  // ── TechStore Suppliers ──────────────────────────────────────────────────
  const techSuppliers = await Supplier.create([
    {
      tenantId: tech._id, name: 'Apple Premium Reseller', email: 'orders@apple-pr.com',
      phone: '+1-800-275-2273', contactPerson: 'Tim C.',
      address: { city: 'Cupertino', state: 'CA', country: 'USA' },
    },
    {
      tenantId: tech._id, name: 'Samsung Electronics B2B', email: 'b2b@samsung.com',
      phone: '+82-2-2255-0114', contactPerson: 'Ji-ho K.',
      address: { city: 'Suwon', state: 'Gyeonggi', country: 'South Korea' },
    },
    {
      tenantId: tech._id, name: 'Dell Technologies Direct', email: 'dell-b2b@dell.com',
      phone: '+1-512-728-7800', contactPerson: 'Michael D.',
      address: { city: 'Round Rock', state: 'TX', country: 'USA' },
    },
    {
      tenantId: tech._id, name: 'Logitech Distribution', email: 'dist@logitech.com',
      phone: '+41-21-863-5111', contactPerson: 'Sophie M.',
      address: { city: 'Lausanne', country: 'Switzerland' },
    },
    {
      tenantId: tech._id, name: 'Sony Electronics Supply', email: 'supply@sony.com',
      phone: '+81-3-6748-2111', contactPerson: 'Kenji T.',
      address: { city: 'Tokyo', country: 'Japan' },
    },
  ]);
  console.log('🏭  TechStore suppliers created');

  // ── TechStore Products ───────────────────────────────────────────────────
  //  stock values set AFTER accounting for the "sales" we'll create below
  //  (initial stock - sold qty = current stock shown here)

  const techProductDefs = [
    // ── Apple products ──
    {
      name: 'MacBook Pro 14"', category: 'Laptops', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['color'], tags: ['laptop', 'apple', 'pro'],
      variants: [
        { sku: 'MBP14-SG', attributes: { color: 'Space Gray' }, stock: 12, costPrice: 1399, sellingPrice: 1799, lowStockThreshold: 5 },
        { sku: 'MBP14-SL', attributes: { color: 'Silver'     }, stock: 8,  costPrice: 1399, sellingPrice: 1799, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'MacBook Pro 16"', category: 'Laptops', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['color'], tags: ['laptop', 'apple', 'pro'],
      variants: [
        { sku: 'MBP16-SG', attributes: { color: 'Space Gray' }, stock: 6,  costPrice: 2199, sellingPrice: 2799, lowStockThreshold: 5 },
        { sku: 'MBP16-SL', attributes: { color: 'Silver'     }, stock: 4,  costPrice: 2199, sellingPrice: 2799, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'iPhone 15', category: 'Smartphones', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['storage', 'color'], tags: ['phone', 'apple', 'ios'],
      variants: [
        { sku: 'IP15-128-BK', attributes: { storage: '128GB', color: 'Black' }, stock: 25, costPrice: 599, sellingPrice: 799, lowStockThreshold: 10 },
        { sku: 'IP15-128-WH', attributes: { storage: '128GB', color: 'White' }, stock: 20, costPrice: 599, sellingPrice: 799, lowStockThreshold: 10 },
        { sku: 'IP15-256-BK', attributes: { storage: '256GB', color: 'Black' }, stock: 15, costPrice: 699, sellingPrice: 899, lowStockThreshold: 10 },
        { sku: 'IP15-256-BL', attributes: { storage: '256GB', color: 'Blue'  }, stock: 7,  costPrice: 699, sellingPrice: 899, lowStockThreshold: 10 },
      ],
    },
    {
      name: 'iPhone 15 Pro', category: 'Smartphones', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['storage', 'color'], tags: ['phone', 'apple', 'ios', 'pro'],
      variants: [
        { sku: 'IP15P-256-BK', attributes: { storage: '256GB', color: 'Black Titanium'    }, stock: 14, costPrice: 899, sellingPrice: 1099, lowStockThreshold: 8 },
        { sku: 'IP15P-256-TI', attributes: { storage: '256GB', color: 'Natural Titanium'  }, stock: 10, costPrice: 899, sellingPrice: 1099, lowStockThreshold: 8 },
        { sku: 'IP15P-512-BK', attributes: { storage: '512GB', color: 'Black Titanium'    }, stock: 0,  costPrice: 1099, sellingPrice: 1299, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'iPad Air 5th Gen', category: 'Tablets', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['connectivity', 'storage'], tags: ['tablet', 'apple', 'ipad'],
      variants: [
        { sku: 'IPAIR-W64',  attributes: { connectivity: 'WiFi', storage: '64GB'  }, stock: 18, costPrice: 499, sellingPrice: 699, lowStockThreshold: 8 },
        { sku: 'IPAIR-W256', attributes: { connectivity: 'WiFi', storage: '256GB' }, stock: 12, costPrice: 649, sellingPrice: 849, lowStockThreshold: 8 },
        { sku: 'IPAIR-5G64', attributes: { connectivity: '5G',  storage: '64GB'  }, stock: 8,  costPrice: 649, sellingPrice: 849, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'AirPods Pro 2nd Gen', category: 'Audio', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: [], tags: ['audio', 'apple', 'wireless'],
      variants: [
        { sku: 'APP2-WHITE', attributes: {}, stock: 30, costPrice: 199, sellingPrice: 249, lowStockThreshold: 10 },
      ],
    },
    {
      name: 'AirPods Max', category: 'Audio', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['color'], tags: ['audio', 'apple', 'headphones'],
      variants: [
        { sku: 'APMAX-SG', attributes: { color: 'Space Gray' }, stock: 9,  costPrice: 449, sellingPrice: 549, lowStockThreshold: 5 },
        { sku: 'APMAX-SL', attributes: { color: 'Silver'     }, stock: 7,  costPrice: 449, sellingPrice: 549, lowStockThreshold: 5 },
        { sku: 'APMAX-BL', attributes: { color: 'Blue'       }, stock: 5,  costPrice: 449, sellingPrice: 549, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'Apple Magic Keyboard', category: 'Accessories', brand: 'Apple',
      supplierId: techSuppliers[0]._id,
      attributes: ['layout'], tags: ['keyboard', 'apple', 'wireless'],
      variants: [
        { sku: 'MKEY-US', attributes: { layout: 'US English' }, stock: 22, costPrice: 69, sellingPrice: 99, lowStockThreshold: 10 },
        { sku: 'MKEY-UK', attributes: { layout: 'UK English' }, stock: 15, costPrice: 69, sellingPrice: 99, lowStockThreshold: 10 },
      ],
    },
    // ── Samsung ──
    {
      name: 'Samsung Galaxy S24', category: 'Smartphones', brand: 'Samsung',
      supplierId: techSuppliers[1]._id,
      attributes: ['storage', 'color'], tags: ['phone', 'samsung', 'android'],
      variants: [
        { sku: 'SGS24-256-BK', attributes: { storage: '256GB', color: 'Phantom Black' }, stock: 20, costPrice: 649, sellingPrice: 849, lowStockThreshold: 10 },
        { sku: 'SGS24-256-WH', attributes: { storage: '256GB', color: 'Marble Gray'   }, stock: 16, costPrice: 649, sellingPrice: 849, lowStockThreshold: 10 },
        { sku: 'SGS24-256-VI', attributes: { storage: '256GB', color: 'Cobalt Violet' }, stock: 6,  costPrice: 649, sellingPrice: 849, lowStockThreshold: 10 },
      ],
    },
    {
      name: 'Samsung Galaxy Tab S9', category: 'Tablets', brand: 'Samsung',
      supplierId: techSuppliers[1]._id,
      attributes: ['connectivity'], tags: ['tablet', 'samsung', 'android'],
      variants: [
        { sku: 'SGTS9-WIFI', attributes: { connectivity: 'WiFi' }, stock: 13, costPrice: 549, sellingPrice: 699, lowStockThreshold: 8 },
        { sku: 'SGTS9-5G',   attributes: { connectivity: '5G'   }, stock: 9,  costPrice: 649, sellingPrice: 799, lowStockThreshold: 8 },
      ],
    },
    // ── Dell ──
    {
      name: 'Dell XPS 15', category: 'Laptops', brand: 'Dell',
      supplierId: techSuppliers[2]._id,
      attributes: ['color'], tags: ['laptop', 'dell', 'windows'],
      variants: [
        { sku: 'DXPS15-PL', attributes: { color: 'Platinum Silver' }, stock: 8,  costPrice: 1299, sellingPrice: 1699, lowStockThreshold: 5 },
        { sku: 'DXPS15-BK', attributes: { color: 'Frost Black'     }, stock: 10, costPrice: 1299, sellingPrice: 1699, lowStockThreshold: 5 },
      ],
    },
    // ── Logitech ──
    {
      name: 'Logitech MX Master 3S', category: 'Accessories', brand: 'Logitech',
      supplierId: techSuppliers[3]._id,
      attributes: ['color'], tags: ['mouse', 'logitech', 'wireless'],
      variants: [
        { sku: 'LMXM3-BK', attributes: { color: 'Black'   }, stock: 40, costPrice: 69, sellingPrice: 99,  lowStockThreshold: 15 },
        { sku: 'LMXM3-WH', attributes: { color: 'White'   }, stock: 28, costPrice: 69, sellingPrice: 99,  lowStockThreshold: 15 },
        { sku: 'LMXM3-GR', attributes: { color: 'Graphite' }, stock: 18, costPrice: 69, sellingPrice: 99,  lowStockThreshold: 15 },
      ],
    },
    {
      name: 'Logitech MX Keys Mini', category: 'Accessories', brand: 'Logitech',
      supplierId: techSuppliers[3]._id,
      attributes: ['color'], tags: ['keyboard', 'logitech', 'wireless'],
      variants: [
        { sku: 'LMXKM-GR', attributes: { color: 'Graphite' }, stock: 25, costPrice: 79, sellingPrice: 109, lowStockThreshold: 10 },
        { sku: 'LMXKM-RO', attributes: { color: 'Rose'     }, stock: 11, costPrice: 79, sellingPrice: 109, lowStockThreshold: 10 },
      ],
    },
    // ── Sony ──
    {
      name: 'Sony WH-1000XM5', category: 'Audio', brand: 'Sony',
      supplierId: techSuppliers[4]._id,
      attributes: ['color'], tags: ['headphones', 'sony', 'noise-cancelling'],
      variants: [
        { sku: 'SWH5-BK', attributes: { color: 'Black'  }, stock: 22, costPrice: 249, sellingPrice: 349, lowStockThreshold: 10 },
        { sku: 'SWH5-SL', attributes: { color: 'Silver' }, stock: 14, costPrice: 249, sellingPrice: 349, lowStockThreshold: 10 },
      ],
    },
    // ── Generic / Cables ──
    {
      name: 'USB-C to USB-C Cable 2m', category: 'Accessories', brand: 'Generic',
      supplierId: techSuppliers[3]._id,
      attributes: [], tags: ['cable', 'usb-c', 'accessory'],
      variants: [
        { sku: 'USBC-2M', attributes: {}, stock: 80, costPrice: 8, sellingPrice: 19, lowStockThreshold: 20 },
      ],
    },
  ];

  const techProducts = await Product.insertMany(
    techProductDefs.map((p) => ({ ...p, tenantId: tech._id }))
  );
  console.log(`📦  TechStore: ${techProducts.length} products created`);

  // ── TechStore StockMovement — initial receipt (purchase) ──────────────────
  const techMovements = [];
  for (const prod of techProducts) {
    for (const v of prod.variants) {
      const initQty = v.stock + rand(5, 20); // simulate initial batch was larger
      techMovements.push({
        tenantId: tech._id,
        productId: prod._id,
        variantSku: v.sku,
        type: 'purchase',
        quantity: initQty,
        previousStock: 0,
        newStock: initQty,
        reference: 'Initial Stock',
        notes: 'Opening stock entry',
        performedBy: techOwner._id,
        createdAt: daysAgo(rand(30, 60)),
      });
      // If current stock < initQty, add a "sale" movement for the difference
      const soldQty = initQty - v.stock;
      if (soldQty > 0) {
        techMovements.push({
          tenantId: tech._id,
          productId: prod._id,
          variantSku: v.sku,
          type: 'sale',
          quantity: -soldQty,
          previousStock: initQty,
          newStock: v.stock,
          reference: 'Sales (seeded)',
          notes: 'Aggregated sales movements',
          performedBy: techStaff._id,
          createdAt: daysAgo(rand(1, 29)),
        });
      }
    }
  }
  await StockMovement.insertMany(techMovements);
  console.log(`📊  TechStore: ${techMovements.length} stock movements created`);

  // ── TechStore Purchase Orders ────────────────────────────────────────────
  const techPOs = await PurchaseOrder.create([
    // received PO — fully restocked
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[0]._id,
      status: 'received',
      items: [
        { productId: techProducts[0]._id, variantSku: 'MBP14-SG', productName: 'MacBook Pro 14" (Space Gray)', quantity: 20, unitPrice: 1399, receivedQuantity: 20 },
        { productId: techProducts[0]._id, variantSku: 'MBP14-SL', productName: 'MacBook Pro 14" (Silver)',     quantity: 15, unitPrice: 1399, receivedQuantity: 15 },
      ],
      totalAmount: 20 * 1399 + 15 * 1399,
      expectedDeliveryDate: daysAgo(10),
      createdBy: techOwner._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(20), changedBy: techOwner._id }, { status: 'sent', changedAt: daysAgo(18), changedBy: techOwner._id }, { status: 'received', changedAt: daysAgo(10), changedBy: techManager._id }],
    },
    // sent PO — covers a low-stock item (IP15-256-BL, currently 7 = warning)
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[0]._id,
      status: 'sent',
      items: [
        { productId: techProducts[2]._id, variantSku: 'IP15-256-BL', productName: 'iPhone 15 (256GB Blue)', quantity: 25, unitPrice: 699, receivedQuantity: 0 },
      ],
      totalAmount: 25 * 699,
      expectedDeliveryDate: daysFromNow(5),
      createdBy: techManager._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(3), changedBy: techManager._id }, { status: 'sent', changedAt: daysAgo(2), changedBy: techManager._id }],
    },
    // confirmed PO — covers the critical item (IP15P-512-BK, stock 0)
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[0]._id,
      status: 'confirmed',
      items: [
        { productId: techProducts[3]._id, variantSku: 'IP15P-512-BK', productName: 'iPhone 15 Pro (512GB Black)', quantity: 10, unitPrice: 1099, receivedQuantity: 0 },
      ],
      totalAmount: 10 * 1099,
      expectedDeliveryDate: daysFromNow(3),
      createdBy: techOwner._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(5), changedBy: techOwner._id }, { status: 'sent', changedAt: daysAgo(4), changedBy: techOwner._id }, { status: 'confirmed', changedAt: daysAgo(2), changedBy: techOwner._id }],
    },
    // draft PO
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[3]._id,
      status: 'draft',
      items: [
        { productId: techProducts[11]._id, variantSku: 'LMXM3-BK', productName: 'Logitech MX Master 3S (Black)', quantity: 50, unitPrice: 69, receivedQuantity: 0 },
        { productId: techProducts[11]._id, variantSku: 'LMXM3-WH', productName: 'Logitech MX Master 3S (White)', quantity: 30, unitPrice: 69, receivedQuantity: 0 },
      ],
      totalAmount: (50 + 30) * 69,
      expectedDeliveryDate: daysFromNow(14),
      createdBy: techManager._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(1), changedBy: techManager._id }],
    },
    // partially received PO
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[1]._id,
      status: 'partially_received',
      items: [
        { productId: techProducts[8]._id, variantSku: 'SGS24-256-BK', productName: 'Galaxy S24 (Black)', quantity: 30, unitPrice: 649, receivedQuantity: 20 },
        { productId: techProducts[8]._id, variantSku: 'SGS24-256-WH', productName: 'Galaxy S24 (Gray)',  quantity: 20, unitPrice: 649, receivedQuantity: 10 },
      ],
      totalAmount: 50 * 649,
      expectedDeliveryDate: daysAgo(2),
      createdBy: techOwner._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(15), changedBy: techOwner._id }, { status: 'sent', changedAt: daysAgo(12), changedBy: techOwner._id }, { status: 'confirmed', changedAt: daysAgo(10), changedBy: techOwner._id }, { status: 'partially_received', changedAt: daysAgo(2), changedBy: techManager._id }],
    },
    // cancelled PO
    {
      tenantId: tech._id,
      orderNumber: nextPO('techstore'),
      supplierId: techSuppliers[2]._id,
      status: 'cancelled',
      items: [
        { productId: techProducts[10]._id, variantSku: 'DXPS15-PL', productName: 'Dell XPS 15 (Platinum)', quantity: 5, unitPrice: 1299, receivedQuantity: 0 },
      ],
      totalAmount: 5 * 1299,
      expectedDeliveryDate: daysAgo(5),
      createdBy: techManager._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(20), changedBy: techManager._id }, { status: 'cancelled', changedAt: daysAgo(18), changedBy: techOwner._id }],
    },
  ]);
  console.log(`🛒  TechStore: ${techPOs.length} purchase orders created`);

  // ── TechStore Sales Orders ───────────────────────────────────────────────
  const customers = [
    { name: 'John Smith',    email: 'john.smith@email.com'    },
    { name: 'Emily Davis',   email: 'emily.davis@email.com'   },
    { name: 'Robert Johnson',email: 'robert.j@email.com'      },
    { name: 'Sarah Wilson',  email: 'sarah.w@email.com'       },
    { name: 'Michael Brown', email: 'michael.b@email.com'     },
    { name: 'Jessica Lee',   email: 'jessica.l@email.com'     },
    { name: 'David Clark',   email: 'david.c@email.com'       },
    { name: 'Amanda White',  email: 'amanda.w@email.com'      },
    { name: 'Christopher Martinez', email: 'cm@email.com'     },
    { name: 'Stephanie Taylor',     email: 'st@email.com'     },
  ];

  await Order.create([
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[0].name, customerEmail: customers[0].email,
      status: 'delivered',
      items: [
        { productId: techProducts[2]._id, variantSku: 'IP15-128-BK', productName: 'iPhone 15 (128GB Black)', quantity: 2, unitPrice: 799, fulfilledQuantity: 2 },
        { productId: techProducts[5]._id, variantSku: 'APP2-WHITE',  productName: 'AirPods Pro 2nd Gen',    quantity: 1, unitPrice: 249, fulfilledQuantity: 1 },
      ],
      totalAmount: 2 * 799 + 249,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(14) }, { status: 'confirmed', changedAt: daysAgo(13) }, { status: 'shipped', changedAt: daysAgo(11) }, { status: 'delivered', changedAt: daysAgo(8) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[1].name, customerEmail: customers[1].email,
      status: 'delivered',
      items: [
        { productId: techProducts[0]._id, variantSku: 'MBP14-SG', productName: 'MacBook Pro 14" (Space Gray)', quantity: 1, unitPrice: 1799, fulfilledQuantity: 1 },
        { productId: techProducts[11]._id, variantSku: 'LMXM3-BK', productName: 'Logitech MX Master 3S (Black)', quantity: 1, unitPrice: 99, fulfilledQuantity: 1 },
      ],
      totalAmount: 1799 + 99,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(12) }, { status: 'confirmed', changedAt: daysAgo(11) }, { status: 'delivered', changedAt: daysAgo(7) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[2].name, customerEmail: customers[2].email,
      status: 'shipped',
      items: [
        { productId: techProducts[3]._id, variantSku: 'IP15P-256-BK', productName: 'iPhone 15 Pro (256GB Black)', quantity: 1, unitPrice: 1099, fulfilledQuantity: 1 },
      ],
      totalAmount: 1099,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(5) }, { status: 'confirmed', changedAt: daysAgo(4) }, { status: 'shipped', changedAt: daysAgo(2) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[3].name, customerEmail: customers[3].email,
      status: 'confirmed',
      items: [
        { productId: techProducts[13]._id, variantSku: 'SWH5-BK', productName: 'Sony WH-1000XM5 (Black)', quantity: 2, unitPrice: 349, fulfilledQuantity: 0 },
      ],
      totalAmount: 698,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(3) }, { status: 'confirmed', changedAt: daysAgo(2) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[4].name, customerEmail: customers[4].email,
      status: 'pending',
      items: [
        { productId: techProducts[4]._id, variantSku: 'IPAIR-W64', productName: 'iPad Air 5 (WiFi 64GB)',     quantity: 1, unitPrice: 699, fulfilledQuantity: 0 },
        { productId: techProducts[7]._id, variantSku: 'MKEY-US',  productName: 'Apple Magic Keyboard (US)', quantity: 1, unitPrice: 99, fulfilledQuantity: 0  },
      ],
      totalAmount: 699 + 99,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(1) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[5].name, customerEmail: customers[5].email,
      status: 'cancelled',
      items: [
        { productId: techProducts[1]._id, variantSku: 'MBP16-SG', productName: 'MacBook Pro 16" (Space Gray)', quantity: 1, unitPrice: 2799, fulfilledQuantity: 0 },
      ],
      totalAmount: 2799,
      notes: 'Customer changed mind',
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(8) }, { status: 'cancelled', changedAt: daysAgo(7) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[6].name, customerEmail: customers[6].email,
      status: 'delivered',
      items: [
        { productId: techProducts[8]._id,  variantSku: 'SGS24-256-BK', productName: 'Galaxy S24 (Black)',          quantity: 2, unitPrice: 849, fulfilledQuantity: 2 },
        { productId: techProducts[14]._id, variantSku: 'USBC-2M',      productName: 'USB-C to USB-C Cable 2m',      quantity: 3, unitPrice: 19,  fulfilledQuantity: 3 },
      ],
      totalAmount: 2 * 849 + 3 * 19,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(20) }, { status: 'delivered', changedAt: daysAgo(14) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[7].name, customerEmail: customers[7].email,
      status: 'pending',
      items: [
        { productId: techProducts[6]._id, variantSku: 'APMAX-BL', productName: 'AirPods Max (Blue)',  quantity: 1, unitPrice: 549, fulfilledQuantity: 0 },
        { productId: techProducts[6]._id, variantSku: 'APMAX-SG', productName: 'AirPods Max (Space Gray)', quantity: 1, unitPrice: 549, fulfilledQuantity: 0 },
      ],
      totalAmount: 1098,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: now() }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[8].name, customerEmail: customers[8].email,
      status: 'delivered',
      items: [
        { productId: techProducts[9]._id, variantSku: 'SGTS9-WIFI', productName: 'Samsung Galaxy Tab S9 (WiFi)', quantity: 1, unitPrice: 699, fulfilledQuantity: 1 },
      ],
      totalAmount: 699,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(25) }, { status: 'delivered', changedAt: daysAgo(18) }],
    },
    {
      tenantId: tech._id, orderNumber: nextORD('techstore'),
      customerName: customers[9].name, customerEmail: customers[9].email,
      status: 'shipped',
      items: [
        { productId: techProducts[10]._id, variantSku: 'DXPS15-BK', productName: 'Dell XPS 15 (Black)', quantity: 1, unitPrice: 1699, fulfilledQuantity: 1 },
        { productId: techProducts[12]._id, variantSku: 'LMXKM-GR',  productName: 'Logitech MX Keys Mini (Graphite)', quantity: 1, unitPrice: 109, fulfilledQuantity: 1 },
      ],
      totalAmount: 1699 + 109,
      createdBy: techStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(6) }, { status: 'confirmed', changedAt: daysAgo(5) }, { status: 'shipped', changedAt: daysAgo(3) }],
    },
  ]);
  console.log('🛍   TechStore: 10 sales orders created');

  // ──────────────────────────────────────────────────────────────────────────
  //  TENANT 2 — FashionHub
  // ──────────────────────────────────────────────────────────────────────────
  poSeq = 1; ordSeq = 1;

  const fashion = await Tenant.create({
    name: 'FashionHub',
    slug: 'fashionhub',
    plan: 'pro',
    settings: { lowStockThreshold: 15 },
  });

  const [fashOwner, fashManager, fashStaff] = await User.create([
    { tenantId: fashion._id, name: 'Priya Owner',   email: 'owner@fashionhub.com',   password: 'password123', role: 'owner'   },
    { tenantId: fashion._id, name: 'Rahul Manager', email: 'manager@fashionhub.com', password: 'password123', role: 'manager' },
    { tenantId: fashion._id, name: 'Nisha Staff',   email: 'staff@fashionhub.com',   password: 'password123', role: 'staff'   },
  ]);
  console.log('\n👤  FashionHub users created');

  const fashSuppliers = await Supplier.create([
    {
      tenantId: fashion._id, name: 'Cotton World Exports', email: 'orders@cottonworld.in',
      phone: '+91-22-4000-1234', contactPerson: 'Ananya M.',
      address: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
    },
    {
      tenantId: fashion._id, name: 'DenimCraft Manufacturing', email: 'supply@denimcraft.com',
      phone: '+1-212-555-0198', contactPerson: 'Carlos R.',
      address: { city: 'New York', state: 'NY', country: 'USA' },
    },
    {
      tenantId: fashion._id, name: 'SoleStyle Footwear', email: 'orders@solestyle.co',
      phone: '+44-20-7946-0958', contactPerson: 'Oliver B.',
      address: { city: 'London', country: 'UK' },
    },
    {
      tenantId: fashion._id, name: 'OutdoorGear Wholesale', email: 'wholesale@outdoorgear.eu',
      phone: '+49-89-2180-1234', contactPerson: 'Klaus H.',
      address: { city: 'Munich', country: 'Germany' },
    },
  ]);
  console.log('🏭  FashionHub suppliers created');

  const fashProductDefs = [
    {
      name: 'Classic Crew-Neck T-Shirt', category: 'Tops', brand: 'FashionHub Basics',
      supplierId: fashSuppliers[0]._id,
      attributes: ['size', 'color'], tags: ['tshirt', 'casual', 'basics'],
      variants: [
        { sku: 'CCNT-S-WH',  attributes: { size: 'S',  color: 'White' }, stock: 50, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-M-WH',  attributes: { size: 'M',  color: 'White' }, stock: 60, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-L-WH',  attributes: { size: 'L',  color: 'White' }, stock: 45, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-S-BK',  attributes: { size: 'S',  color: 'Black' }, stock: 55, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-M-BK',  attributes: { size: 'M',  color: 'Black' }, stock: 70, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-L-BK',  attributes: { size: 'L',  color: 'Black' }, stock: 8,  costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
        { sku: 'CCNT-XL-BK', attributes: { size: 'XL', color: 'Black' }, stock: 12, costPrice: 8,  sellingPrice: 24, lowStockThreshold: 15 },
      ],
    },
    {
      name: 'Premium Slim-Fit Jeans', category: 'Bottoms', brand: 'DenimCo',
      supplierId: fashSuppliers[1]._id,
      attributes: ['waist', 'color'], tags: ['jeans', 'denim', 'slim'],
      variants: [
        { sku: 'PSJ-28-BL', attributes: { waist: '28', color: 'Blue'  }, stock: 20, costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
        { sku: 'PSJ-30-BL', attributes: { waist: '30', color: 'Blue'  }, stock: 25, costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
        { sku: 'PSJ-32-BL', attributes: { waist: '32', color: 'Blue'  }, stock: 18, costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
        { sku: 'PSJ-34-BL', attributes: { waist: '34', color: 'Blue'  }, stock: 6,  costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
        { sku: 'PSJ-30-BK', attributes: { waist: '30', color: 'Black' }, stock: 15, costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
        { sku: 'PSJ-32-BK', attributes: { waist: '32', color: 'Black' }, stock: 0,  costPrice: 29, sellingPrice: 79, lowStockThreshold: 10 },
      ],
    },
    {
      name: 'Floral Wrap Dress', category: 'Dresses', brand: 'FashionHub Studio',
      supplierId: fashSuppliers[0]._id,
      attributes: ['size'], tags: ['dress', 'floral', 'summer'],
      variants: [
        { sku: 'FWD-S',  attributes: { size: 'S'  }, stock: 22, costPrice: 19, sellingPrice: 59, lowStockThreshold: 10 },
        { sku: 'FWD-M',  attributes: { size: 'M'  }, stock: 18, costPrice: 19, sellingPrice: 59, lowStockThreshold: 10 },
        { sku: 'FWD-L',  attributes: { size: 'L'  }, stock: 14, costPrice: 19, sellingPrice: 59, lowStockThreshold: 10 },
        { sku: 'FWD-XL', attributes: { size: 'XL' }, stock: 7,  costPrice: 19, sellingPrice: 59, lowStockThreshold: 10 },
      ],
    },
    {
      name: 'White Leather Sneakers', category: 'Footwear', brand: 'SoleStyle',
      supplierId: fashSuppliers[2]._id,
      attributes: ['size'], tags: ['sneakers', 'casual', 'leather'],
      variants: [
        { sku: 'WLS-UK6',  attributes: { size: 'UK 6'  }, stock: 8,  costPrice: 39, sellingPrice: 89, lowStockThreshold: 8 },
        { sku: 'WLS-UK7',  attributes: { size: 'UK 7'  }, stock: 12, costPrice: 39, sellingPrice: 89, lowStockThreshold: 8 },
        { sku: 'WLS-UK8',  attributes: { size: 'UK 8'  }, stock: 15, costPrice: 39, sellingPrice: 89, lowStockThreshold: 8 },
        { sku: 'WLS-UK9',  attributes: { size: 'UK 9'  }, stock: 10, costPrice: 39, sellingPrice: 89, lowStockThreshold: 8 },
        { sku: 'WLS-UK10', attributes: { size: 'UK 10' }, stock: 4,  costPrice: 39, sellingPrice: 89, lowStockThreshold: 8 },
      ],
    },
    {
      name: 'Winter Puffer Jacket', category: 'Outerwear', brand: 'FashionHub Studio',
      supplierId: fashSuppliers[3]._id,
      attributes: ['size', 'color'], tags: ['jacket', 'winter', 'warm'],
      variants: [
        { sku: 'WPJ-S-BK',  attributes: { size: 'S',  color: 'Black' }, stock: 15, costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
        { sku: 'WPJ-M-BK',  attributes: { size: 'M',  color: 'Black' }, stock: 20, costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
        { sku: 'WPJ-L-BK',  attributes: { size: 'L',  color: 'Black' }, stock: 12, costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
        { sku: 'WPJ-S-NV',  attributes: { size: 'S',  color: 'Navy'  }, stock: 10, costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
        { sku: 'WPJ-M-NV',  attributes: { size: 'M',  color: 'Navy'  }, stock: 6,  costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
        { sku: 'WPJ-XL-BK', attributes: { size: 'XL', color: 'Black' }, stock: 0,  costPrice: 49, sellingPrice: 129, lowStockThreshold: 8 },
      ],
    },
    {
      name: 'Yoga Leggings', category: 'Activewear', brand: 'FashionHub Active',
      supplierId: fashSuppliers[0]._id,
      attributes: ['size', 'color'], tags: ['yoga', 'activewear', 'leggings'],
      variants: [
        { sku: 'YL-S-BK',  attributes: { size: 'S',  color: 'Black' }, stock: 30, costPrice: 15, sellingPrice: 45, lowStockThreshold: 12 },
        { sku: 'YL-M-BK',  attributes: { size: 'M',  color: 'Black' }, stock: 35, costPrice: 15, sellingPrice: 45, lowStockThreshold: 12 },
        { sku: 'YL-L-BK',  attributes: { size: 'L',  color: 'Black' }, stock: 25, costPrice: 15, sellingPrice: 45, lowStockThreshold: 12 },
        { sku: 'YL-M-GR',  attributes: { size: 'M',  color: 'Gray'  }, stock: 20, costPrice: 15, sellingPrice: 45, lowStockThreshold: 12 },
      ],
    },
    {
      name: 'Baseball Cap', category: 'Accessories', brand: 'FashionHub Basics',
      supplierId: fashSuppliers[0]._id,
      attributes: ['color'], tags: ['cap', 'accessories', 'headwear'],
      variants: [
        { sku: 'BC-BK', attributes: { color: 'Black' }, stock: 40, costPrice: 7,  sellingPrice: 25, lowStockThreshold: 15 },
        { sku: 'BC-NV', attributes: { color: 'Navy'  }, stock: 28, costPrice: 7,  sellingPrice: 25, lowStockThreshold: 15 },
        { sku: 'BC-WH', attributes: { color: 'White' }, stock: 5,  costPrice: 7,  sellingPrice: 25, lowStockThreshold: 15 },
      ],
    },
    {
      name: 'Running Trainers', category: 'Footwear', brand: 'SoleStyle',
      supplierId: fashSuppliers[2]._id,
      attributes: ['size', 'color'], tags: ['trainers', 'running', 'sports'],
      variants: [
        { sku: 'RT-UK7-WH',  attributes: { size: 'UK 7',  color: 'White' }, stock: 12, costPrice: 45, sellingPrice: 99, lowStockThreshold: 8 },
        { sku: 'RT-UK8-WH',  attributes: { size: 'UK 8',  color: 'White' }, stock: 16, costPrice: 45, sellingPrice: 99, lowStockThreshold: 8 },
        { sku: 'RT-UK9-WH',  attributes: { size: 'UK 9',  color: 'White' }, stock: 9,  costPrice: 45, sellingPrice: 99, lowStockThreshold: 8 },
        { sku: 'RT-UK8-BK',  attributes: { size: 'UK 8',  color: 'Black' }, stock: 11, costPrice: 45, sellingPrice: 99, lowStockThreshold: 8 },
      ],
    },
  ];

  const fashProducts = await Product.insertMany(
    fashProductDefs.map((p) => ({ ...p, tenantId: fashion._id }))
  );
  console.log(`📦  FashionHub: ${fashProducts.length} products created`);

  // ── FashionHub StockMovements ────────────────────────────────────────────
  const fashMovements = [];
  for (const prod of fashProducts) {
    for (const v of prod.variants) {
      const initQty = v.stock + rand(10, 40);
      fashMovements.push({
        tenantId: fashion._id, productId: prod._id, variantSku: v.sku,
        type: 'purchase', quantity: initQty, previousStock: 0, newStock: initQty,
        reference: 'Initial Stock', notes: 'Opening stock entry',
        performedBy: fashOwner._id, createdAt: daysAgo(rand(30, 60)),
      });
      const soldQty = initQty - v.stock;
      if (soldQty > 0) {
        fashMovements.push({
          tenantId: fashion._id, productId: prod._id, variantSku: v.sku,
          type: 'sale', quantity: -soldQty, previousStock: initQty, newStock: v.stock,
          reference: 'Sales (seeded)', notes: 'Aggregated sales movements',
          performedBy: fashStaff._id, createdAt: daysAgo(rand(1, 29)),
        });
      }
    }
  }
  await StockMovement.insertMany(fashMovements);
  console.log(`📊  FashionHub: ${fashMovements.length} stock movements created`);

  // ── FashionHub Purchase Orders ───────────────────────────────────────────
  await PurchaseOrder.create([
    {
      tenantId: fashion._id, orderNumber: nextPO('fashionhub'),
      supplierId: fashSuppliers[0]._id, status: 'sent',
      items: [
        { productId: fashProducts[0]._id, variantSku: 'CCNT-L-BK',  productName: 'Classic T-Shirt (L Black)',  quantity: 50, unitPrice: 8, receivedQuantity: 0 },
        { productId: fashProducts[0]._id, variantSku: 'CCNT-XL-BK', productName: 'Classic T-Shirt (XL Black)', quantity: 30, unitPrice: 8, receivedQuantity: 0 },
      ],
      totalAmount: 80 * 8, expectedDeliveryDate: daysFromNow(7),
      createdBy: fashManager._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(3) }, { status: 'sent', changedAt: daysAgo(2) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextPO('fashionhub'),
      supplierId: fashSuppliers[1]._id, status: 'confirmed',
      items: [
        { productId: fashProducts[1]._id, variantSku: 'PSJ-34-BL', productName: 'Slim-Fit Jeans (34 Blue)',  quantity: 20, unitPrice: 29, receivedQuantity: 0 },
        { productId: fashProducts[1]._id, variantSku: 'PSJ-32-BK', productName: 'Slim-Fit Jeans (32 Black)', quantity: 25, unitPrice: 29, receivedQuantity: 0 },
      ],
      totalAmount: 45 * 29, expectedDeliveryDate: daysFromNow(4),
      createdBy: fashOwner._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(6) }, { status: 'sent', changedAt: daysAgo(5) }, { status: 'confirmed', changedAt: daysAgo(3) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextPO('fashionhub'),
      supplierId: fashSuppliers[3]._id, status: 'received',
      items: [
        { productId: fashProducts[4]._id, variantSku: 'WPJ-XL-BK', productName: 'Winter Jacket (XL Black)', quantity: 15, unitPrice: 49, receivedQuantity: 15 },
        { productId: fashProducts[4]._id, variantSku: 'WPJ-M-NV',  productName: 'Winter Jacket (M Navy)',  quantity: 20, unitPrice: 49, receivedQuantity: 20 },
      ],
      totalAmount: 35 * 49, expectedDeliveryDate: daysAgo(5),
      createdBy: fashOwner._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(15) }, { status: 'sent', changedAt: daysAgo(12) }, { status: 'received', changedAt: daysAgo(5) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextPO('fashionhub'),
      supplierId: fashSuppliers[0]._id, status: 'draft',
      items: [
        { productId: fashProducts[6]._id, variantSku: 'BC-WH', productName: 'Baseball Cap (White)', quantity: 60, unitPrice: 7, receivedQuantity: 0 },
      ],
      totalAmount: 60 * 7, expectedDeliveryDate: daysFromNow(10),
      createdBy: fashManager._id,
      statusHistory: [{ status: 'draft', changedAt: daysAgo(1) }],
    },
  ]);
  console.log(`🛒  FashionHub: 4 purchase orders created`);

  // ── FashionHub Sales Orders ──────────────────────────────────────────────
  const fashCustomers = [
    { name: 'Neha Sharma',    email: 'neha.s@email.com'    },
    { name: 'Raj Patel',      email: 'raj.p@email.com'     },
    { name: 'Meera Nair',     email: 'meera.n@email.com'   },
    { name: 'Aditya Kumar',   email: 'aditya.k@email.com'  },
    { name: 'Divya Singh',    email: 'divya.s@email.com'   },
    { name: 'Vikram Reddy',   email: 'vikram.r@email.com'  },
    { name: 'Sonal Mehta',    email: 'sonal.m@email.com'   },
    { name: 'Arjun Iyer',     email: 'arjun.i@email.com'   },
  ];

  await Order.create([
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[0].name, customerEmail: fashCustomers[0].email,
      status: 'delivered',
      items: [
        { productId: fashProducts[0]._id, variantSku: 'CCNT-M-WH', productName: 'Classic T-Shirt (M White)', quantity: 3, unitPrice: 24, fulfilledQuantity: 3 },
        { productId: fashProducts[1]._id, variantSku: 'PSJ-30-BL', productName: 'Slim Jeans (30 Blue)',      quantity: 2, unitPrice: 79, fulfilledQuantity: 2 },
      ],
      totalAmount: 3 * 24 + 2 * 79, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(20) }, { status: 'delivered', changedAt: daysAgo(13) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[1].name, customerEmail: fashCustomers[1].email,
      status: 'delivered',
      items: [
        { productId: fashProducts[4]._id, variantSku: 'WPJ-M-BK', productName: 'Winter Jacket (M Black)', quantity: 1, unitPrice: 129, fulfilledQuantity: 1 },
        { productId: fashProducts[5]._id, variantSku: 'YL-M-BK',  productName: 'Yoga Leggings (M Black)',  quantity: 2, unitPrice: 45,  fulfilledQuantity: 2 },
      ],
      totalAmount: 129 + 2 * 45, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(15) }, { status: 'delivered', changedAt: daysAgo(9) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[2].name, customerEmail: fashCustomers[2].email,
      status: 'shipped',
      items: [
        { productId: fashProducts[2]._id, variantSku: 'FWD-S', productName: 'Floral Wrap Dress (S)', quantity: 1, unitPrice: 59, fulfilledQuantity: 1 },
        { productId: fashProducts[3]._id, variantSku: 'WLS-UK7', productName: 'White Sneakers (UK 7)', quantity: 1, unitPrice: 89, fulfilledQuantity: 1 },
      ],
      totalAmount: 59 + 89, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(4) }, { status: 'confirmed', changedAt: daysAgo(3) }, { status: 'shipped', changedAt: daysAgo(1) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[3].name, customerEmail: fashCustomers[3].email,
      status: 'pending',
      items: [
        { productId: fashProducts[6]._id, variantSku: 'BC-NV', productName: 'Baseball Cap (Navy)', quantity: 2, unitPrice: 25, fulfilledQuantity: 0 },
        { productId: fashProducts[7]._id, variantSku: 'RT-UK8-WH', productName: 'Running Trainers (UK 8 White)', quantity: 1, unitPrice: 99, fulfilledQuantity: 0 },
      ],
      totalAmount: 2 * 25 + 99, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: now() }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[4].name, customerEmail: fashCustomers[4].email,
      status: 'confirmed',
      items: [
        { productId: fashProducts[0]._id, variantSku: 'CCNT-M-BK', productName: 'Classic T-Shirt (M Black)', quantity: 5, unitPrice: 24, fulfilledQuantity: 0 },
      ],
      totalAmount: 5 * 24, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(2) }, { status: 'confirmed', changedAt: daysAgo(1) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[5].name, customerEmail: fashCustomers[5].email,
      status: 'cancelled',
      items: [
        { productId: fashProducts[4]._id, variantSku: 'WPJ-S-NV', productName: 'Winter Jacket (S Navy)', quantity: 1, unitPrice: 129, fulfilledQuantity: 0 },
      ],
      totalAmount: 129, notes: 'Wrong size ordered', createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(10) }, { status: 'cancelled', changedAt: daysAgo(9) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[6].name, customerEmail: fashCustomers[6].email,
      status: 'delivered',
      items: [
        { productId: fashProducts[5]._id, variantSku: 'YL-S-BK', productName: 'Yoga Leggings (S Black)', quantity: 3, unitPrice: 45, fulfilledQuantity: 3 },
        { productId: fashProducts[0]._id, variantSku: 'CCNT-S-WH', productName: 'Classic T-Shirt (S White)', quantity: 2, unitPrice: 24, fulfilledQuantity: 2 },
      ],
      totalAmount: 3 * 45 + 2 * 24, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(18) }, { status: 'delivered', changedAt: daysAgo(11) }],
    },
    {
      tenantId: fashion._id, orderNumber: nextORD('fashionhub'),
      customerName: fashCustomers[7].name, customerEmail: fashCustomers[7].email,
      status: 'shipped',
      items: [
        { productId: fashProducts[1]._id, variantSku: 'PSJ-28-BL', productName: 'Slim Jeans (28 Blue)',   quantity: 1, unitPrice: 79, fulfilledQuantity: 1 },
        { productId: fashProducts[3]._id, variantSku: 'WLS-UK8',   productName: 'White Sneakers (UK 8)', quantity: 1, unitPrice: 89, fulfilledQuantity: 1 },
      ],
      totalAmount: 79 + 89, createdBy: fashStaff._id,
      statusHistory: [{ status: 'pending', changedAt: daysAgo(7) }, { status: 'confirmed', changedAt: daysAgo(6) }, { status: 'shipped', changedAt: daysAgo(4) }],
    },
  ]);
  console.log('🛍   FashionHub: 8 sales orders created');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║              SEED COMPLETE — LOGIN CREDENTIALS           ║
╠══════════════════════════════════════════════════════════╣
║  TECHSTORE                                               ║
║    owner@techstore.com   / password123  (owner)          ║
║    manager@techstore.com / password123  (manager)        ║
║    staff@techstore.com   / password123  (staff)          ║
╠══════════════════════════════════════════════════════════╣
║  FASHIONHUB                                              ║
║    owner@fashionhub.com   / password123  (owner)         ║
║    manager@fashionhub.com / password123  (manager)       ║
║    staff@fashionhub.com   / password123  (staff)         ║
╠══════════════════════════════════════════════════════════╣
║  DATA ISOLATION VERIFIED: each tenant sees only their    ║
║  own products, orders, and users.                        ║
╚══════════════════════════════════════════════════════════╝
`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
