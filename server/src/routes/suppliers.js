const express = require('express');
const { body } = require('express-validator');
const {
  getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
} = require('../controllers/supplierController');
const { protect } = require('../middleware/auth');
const { managerOrAbove } = require('../middleware/rbac');

const router = express.Router();
router.use(protect);

const supplierValidation = [
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email'),
];

router.route('/')
  .get(getSuppliers)
  .post(managerOrAbove, supplierValidation, createSupplier);

router.route('/:id')
  .get(getSupplier)
  .put(managerOrAbove, updateSupplier)
  .delete(managerOrAbove, deleteSupplier);

module.exports = router;
