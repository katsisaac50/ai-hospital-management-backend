const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const DrugInteraction = require('../models/drug-interaction.model');

dotenv.config();

const args = process.argv.slice(2);
const appendMode = args.includes('--append');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const interactions = [];
const csvPath = path.join(__dirname, 'interactions.csv');

fs.createReadStream(csvPath)
  .pipe(csv())
  .on('data', (row) => {
    interactions.push({
      drugA: row.drug_a.trim().toLowerCase(),
      drugB: row.drug_b.trim().toLowerCase(),
      description: row.description.trim(),
      severity: row.severity?.trim().toLowerCase() || 'moderate',
    });
  })
  .on('end', async () => {
    try {
      if (!appendMode) {
        await DrugInteraction.deleteMany({});
        console.log("🧹 Cleared existing interactions");
      }

      await DrugInteraction.insertMany(interactions);
      console.log(`✅ Successfully imported ${interactions.length} interactions`);
    } catch (error) {
      console.error("❌ Error importing:", error);
    } finally {
      mongoose.disconnect();
    }
  });




// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const DrugInteraction = require('../models/drug-interaction.model');

// dotenv.config();
// mongoose.connect(process.env.MONGO_URI);

// const data = [
//   {
//     drugA: 'ibuprofen',
//     drugB: 'aspirin',
//     description: 'Increased risk of GI bleeding',
//     severity: 'moderate',
//   },
//   {
//     drugA: 'paracetamol',
//     drugB: 'alcohol',
//     description: 'Increased risk of liver damage',
//     severity: 'severe',
//   },
// ];

// const seed = async () => {
//   try {
//     await DrugInteraction.deleteMany();
//     await DrugInteraction.insertMany(data);
//     console.log('✅ Drug interactions seeded');
//     process.exit();
//   } catch (error) {
//     console.error('❌ Error seeding:', error);
//     process.exit(1);
//   }
// };

// seed();
