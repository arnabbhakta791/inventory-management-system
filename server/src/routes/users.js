const express = require('express');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { ownerOnly, managerOrAbove } = require('../middleware/rbac');

const router = express.Router();
router.use(protect);

router.route('/')
  .get(managerOrAbove, getUsers)
  .post(ownerOnly, createUser);

router.route('/:id')
  .patch(ownerOnly, updateUser)
  .delete(ownerOnly, deleteUser);

module.exports = router;
