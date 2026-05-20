const express = require('express');
const { getStockMovements, getVariantHistory } = require('../controllers/stockMovementController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', getStockMovements);
router.get('/product/:productId/variant/:sku', getVariantHistory);

module.exports = router;
