const Product        = require('../models/Product');
const StockMovement  = require('../models/StockMovement');
const Order          = require('../models/Order');
const PurchaseOrder  = require('../models/PurchaseOrder');
const { getSmartLowStockAlerts } = require('../services/alertService');

// ─────────────────────────────────────────────────────────────────
// @desc    Dashboard KPI stats
// @route   GET /api/dashboard/stats
// @access  Private
//
// Returns in < 2s for 10k+ products because:
//  • inventory value — single aggregation on Product collection (no joins)
//  • counts — countDocuments uses index scans, not collection scans
//  • all queries run in parallel via Promise.all
// ─────────────────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const [inventoryValue, totalProducts, lowStockAlerts, pendingOrders, pendingPOs] =
      await Promise.all([
        // Total inventory value: sum(stock * costPrice) across all active variants
        Product.aggregate([
          { $match: { tenantId, isActive: true } },
          { $unwind: '$variants' },
          {
            $group: {
              _id: null,
              totalValue: {
                $sum: { $multiply: ['$variants.stock', '$variants.costPrice'] },
              },
              totalUnits: { $sum: '$variants.stock' },
            },
          },
        ]),

        // Total active products
        Product.countDocuments({ tenantId, isActive: true }),

        // Smart low-stock alerts (PO-aware)
        getSmartLowStockAlerts(tenantId),

        // Pending orders count
        Order.countDocuments({ tenantId, status: 'pending' }),

        // Pending purchase orders (sent/confirmed)
        PurchaseOrder.countDocuments({ tenantId, status: { $in: ['sent', 'confirmed'] } }),
      ]);

    const valueData = inventoryValue[0] || { totalValue: 0, totalUnits: 0 };

    res.json({
      success: true,
      data: {
        inventoryValue:  Math.round(valueData.totalValue * 100) / 100,
        totalUnits:      valueData.totalUnits,
        totalProducts,
        lowStockCount:   lowStockAlerts.length,
        criticalCount:   lowStockAlerts.filter((a) => a.severity === 'critical').length,
        pendingOrders,
        pendingPOs,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────
// @desc    PO-aware low-stock alert list (for dashboard widget)
// @route   GET /api/dashboard/low-stock
// @access  Private
// ─────────────────────────────────────────────────────────────────
const getLowStockAlerts = async (req, res, next) => {
  try {
    const limit  = parseInt(req.query.limit) || 10;
    const alerts = await getSmartLowStockAlerts(req.tenantId);
    res.json({ success: true, data: alerts.slice(0, limit), total: alerts.length });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────
// @desc    Top 5 best-selling SKUs — last 30 days
// @route   GET /api/dashboard/top-sellers
// @access  Private
//
// Uses StockMovement (type=sale) instead of Order.items so we get
// accurate sold quantities even for partially-fulfilled orders.
// Index: { tenantId:1, type:1, createdAt:-1 } — hits index on $match.
// ─────────────────────────────────────────────────────────────────
const getTopSellers = async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const topSellers = await StockMovement.aggregate([
      {
        $match: {
          tenantId: req.tenantId,
          type:     'sale',
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id:      '$variantSku',
          productId:{ $first: '$productId' },
          totalSold:{ $sum: { $abs: '$quantity' } }, // quantity is negative for sales
        },
      },
      { $sort:  { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from:         'products',
          localField:   'productId',
          foreignField: '_id',
          as:           'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sku:         '$_id',
          productName: '$product.name',
          category:    '$product.category',
          totalSold:   1,
        },
      },
    ]);

    res.json({ success: true, data: topSellers });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────
// @desc    Stock movement graph — last 7 days (daily in/out totals)
// @route   GET /api/dashboard/stock-graph
// @access  Private
//
// Index: { tenantId:1, createdAt:-1 } — $match uses compound index.
// Groups by day string so frontend can render a bar/line chart directly.
// ─────────────────────────────────────────────────────────────────
const getStockGraph = async (req, res, next) => {
  try {
    // Build the 7-day window entirely in UTC so the result is the same
    // regardless of the timezone of the machine running Node.
    // setHours(0,0,0,0) uses LOCAL time — on IST (UTC+5:30) that is
    // 18:30 UTC the *previous* day, which shifts every key one day early
    // and drops today's movements from the chart.
    const now = new Date();
    const since = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 6,   // 6 days ago at 00:00 UTC → 7 days inclusive
      0, 0, 0, 0
    ));

    const movements = await StockMovement.aggregate([
      {
        $match: {
          tenantId:  req.tenantId,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            // timezone: 'UTC' makes the date string independent of mongod's TZ
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
            },
            direction: {
              $cond: [{ $gt: ['$quantity', 0] }, 'in', 'out'],
            },
          },
          total: { $sum: { $abs: '$quantity' } },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Build a dayMap with exactly 7 UTC date keys: 6 days ago → today
    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 6 + i,
        0, 0, 0, 0
      ));
      const key = d.toISOString().slice(0, 10); // 'YYYY-MM-DD' in UTC
      dayMap[key] = { date: key, in: 0, out: 0 };
    }

    for (const m of movements) {
      const { date, direction } = m._id;
      if (dayMap[date]) dayMap[date][direction] += m.total;
    }

    res.json({ success: true, data: Object.values(dayMap) });
  } catch (err) { next(err); }
};

module.exports = { getStats, getLowStockAlerts, getTopSellers, getStockGraph };
