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

const exportMissingCombinations = async () => {
  try {
    const interactions = await DrugInteraction.find({});
    const drugSet = new Set();

    interactions.forEach(({ drugA, drugB }) => {
      drugSet.add(drugA.toLowerCase());
      drugSet.add(drugB.toLowerCase());
    });

    const drugs = Array.from(drugSet).sort();
    const missingPairs = [];

    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const a = drugs[i];
        const b = drugs[j];

        const exists = await DrugInteraction.exists({
          $or: [
            { drugA: a, drugB: b },
            { drugA: b, drugB: a },
          ],
        });

        if (!exists) {
          missingPairs.push({
            drug_a: a,
            drug_b: b,
            description: '',
            severity: '',
          });
        }
      }
    }

    if (missingPairs.length === 0) {
      console.log('✅ All combinations are covered.');
    } else {
      const parser = new Parser({ fields: ['drug_a', 'drug_b', 'description', 'severity'] });
      const csv = parser.parse(missingPairs);

      const filePath = path.join(__dirname, 'missing_interactions_template.csv');
      fs.writeFileSync(filePath, csv);

      console.log(`📄 Exported ${missingPairs.length} missing pairs to: ${filePath}`);
    }
  } catch (err) {
    console.error('❌ Error exporting missing pairs:', err);
  } finally {
    mongoose.disconnect();
  }
};

exportMissingCombinations();
