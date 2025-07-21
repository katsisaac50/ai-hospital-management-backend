const express = require('express');
const {
  getAllInteractions,
  checkInteraction,
  createInteraction,
  deleteInteraction,
} = require('../controllers/drug-interaction.controller');

const router = express.Router();

router.route('/').get(getAllInteractions).post(createInteraction);
router.route('/check').post(checkInteraction);
router.route('/:id').delete(deleteInteraction);

module.exports = router;
