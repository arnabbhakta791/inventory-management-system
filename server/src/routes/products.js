const express = require('express');
const { body } = require('express-validator');
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, getLowStock, getCategories, adjustVariantStock,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { managerOrAbove } = require('../middleware/rbac');

const router = express.Router();
router.use(protect); // all product routes require auth

const productValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('variants').isArray({ min: 1 }).withMessage('At least one variant is required'),
  body('variants.*.sku').notEmpty().withMessage('Each variant needs a SKU'),
  body('variants.*.costPrice').isFloat({ min: 0 }).withMessage('Cost price must be >= 0'),
  body('variants.*.sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be >= 0'),
];

// Specific routes first (before :id to avoid conflicts)
router.get('/low-stock', getLowStock);
router.get('/categories', getCategories);

router.route('/')
  .get(getProducts)
  .post(managerOrAbove, productValidation, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(managerOrAbove, updateProduct)
  .delete(managerOrAbove, deleteProduct);

router.patch('/:id/variants/:sku/stock', managerOrAbove, adjustVariantStock);

module.exports = router;
