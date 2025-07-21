const mongoose = require("mongoose");

const cronLogSchema = new mongoose.Schema({
  jobName: String,
  runAt: { type: Date, default: Date.now },
  details: String,
  success: Boolean,
  error: String,
});

module.exports = mongoose.model("CronLog", cronLogSchema);
