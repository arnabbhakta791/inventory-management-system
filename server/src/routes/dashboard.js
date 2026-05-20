const express = require('express');
const { getStats, getLowStockAlerts, getTopSellers, getStockGraph } =
  require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/stats',      getStats);
router.get('/low-stock',  getLowStockAlerts);
router.get('/top-sellers',getTopSellers);
router.get('/stock-graph',getStockGraph);

module.exports = router;
