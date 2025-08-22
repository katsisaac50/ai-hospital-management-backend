const mongoose = require("mongoose");

const TestOptionSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  testTypes: [{ type: String, required: true }],
  sampleTypes: [{ type: String, required: true }],
});

module.exports = mongoose.model("TestOption", TestOptionSchema);
