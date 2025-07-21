const express = require('express');
const router = express.Router();
const {
  createDispenseLog,
  getDispenseLogs,
} = require('../controllers/dispense.controller');

router.post('/', createDispenseLog);
router.get('/', getDispenseLogs);

module.exports = router;
