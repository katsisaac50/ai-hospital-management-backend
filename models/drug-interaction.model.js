const mongoose = require('mongoose');

const DrugInteractionSchema = new mongoose.Schema({
  drugA: String,
  drugB: String,
  description: String,
  severity: String,
});

module.exports = mongoose.model('DrugInteraction', DrugInteractionSchema);

