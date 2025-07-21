const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Parser } = require('json2csv');
const DrugInteraction = require('../models/drug-interaction.model');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const exportInteractions = async () => {
  try {
    const data = await DrugInteraction.find({});
    const fields = ['drugA', 'drugB', 'description', 'severity'];
    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(data);

    fs.writeFileSync(path.join(__dirname, 'exported_interactions.csv'), csv);
    console.log("✅ Exported interactions to exported_interactions.csv");
  } catch (err) {
    console.error("❌ Export failed:", err);
  } finally {
    mongoose.disconnect();
  }
};

exportInteractions();
