// scripts/buildIndexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("📦 Loading all models from /models folder...");

    const modelsDir = path.join(__dirname, '../models');
    fs.readdirSync(modelsDir)
      .filter(file => file.endsWith('.js'))
      .forEach(file => {
        require(path.join(modelsDir, file));
        console.log(`✅ Loaded model file: ${file}`);
      });

    console.log("⚡ Building indexes for all models...");
    await mongoose.connection.syncIndexes();

    console.log("🎉 All indexes created successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error building indexes:", err);
    process.exit(1);
  }
})();

