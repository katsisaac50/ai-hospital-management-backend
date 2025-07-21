const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const DrugInteraction = require('../models/drug-interaction.model');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const filePath = path.join(__dirname, 'missing_interactions_template.csv');

const importMissingInteractions = async () => {
  const entries = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const { drug_a, drug_b, description, severity } = row;

      if (
        drug_a && drug_b &&
        description?.trim() &&
        severity?.trim()
      ) {
        entries.push({
          drugA: drug_a.trim().toLowerCase(),
          drugB: drug_b.trim().toLowerCase(),
          description: description.trim(),
          severity: severity.trim().toLowerCase(),
        });
      }
    })
    .on('end', async () => {
      try {
        let added = 0;
        for (const entry of entries) {
          const exists = await DrugInteraction.exists({
            $or: [
              { drugA: entry.drugA, drugB: entry.drugB },
              { drugA: entry.drugB, drugB: entry.drugA },
            ],
          });

          if (!exists) {
            await DrugInteraction.create(entry);
            added++;
          }
        }

        console.log(`✅ Imported ${added} new missing interactions from CSV.`);
      } catch (err) {
        console.error('❌ Error during import:', err);
      } finally {
        mongoose.disconnect();
      }
    });
};

importMissingInteractions();
