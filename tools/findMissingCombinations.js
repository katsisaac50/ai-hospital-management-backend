const mongoose = require('mongoose');
const dotenv = require('dotenv');
const DrugInteraction = require('../models/drug-interaction.model');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const findMissingPairs = async () => {
  try {
    // Step 1: Get all unique drugs mentioned in the database
    const interactions = await DrugInteraction.find({});
    const drugSet = new Set();

    interactions.forEach(({ drugA, drugB }) => {
      drugSet.add(drugA.toLowerCase());
      drugSet.add(drugB.toLowerCase());
    });

    const drugs = Array.from(drugSet).sort();
    const missingPairs = [];

    // Step 2: Generate all possible unique combinations (a ≠ b)
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
          missingPairs.push([a, b]);
        }
      }
    }

    // Step 3: Output result
    if (missingPairs.length === 0) {
      console.log("✅ No missing combinations found.");
    } else {
      console.log(`🚨 Found ${missingPairs.length} missing interaction pairs:\n`);
      missingPairs.forEach(([a, b]) => {
        console.log(`❌ Missing: ${capitalize(a)} ↔ ${capitalize(b)}`);
      });
    }

  } catch (error) {
    console.error("❌ Error finding missing pairs:", error);
  } finally {
    mongoose.disconnect();
  }
};

const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

findMissingPairs();
