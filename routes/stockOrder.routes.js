const express = require('express')
const {
  getStockOrders,
  getStockOrder,
  createStockOrder,
  updateStockOrder,
  deleteStockOrder,
} = require('../controllers/stockOrder.controller')

const router = express.Router()

router.route('/')
  .get(getStockOrders)
  .post(createStockOrder)

router.route('/:id')
  .get(getStockOrder)
  .put(updateStockOrder)
  .delete(deleteStockOrder)

module.exports = router
