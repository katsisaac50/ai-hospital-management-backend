// seed.js
const mongoose = require('mongoose');
require('dotenv').config(); // if you use .env for MONGO_URI

const seedUsers = require('./seedUsers');        // your user seeder
const seedEquipment = require('./seedEquipment'); // the equipment seeder I gave you

async function runSeeders() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected');

    // Clear collections if you want
    // await mongoose.connection.db.dropCollection('users');
    // await mongoose.connection.db.dropCollection('equipment');

    await seedUsers(10);       // Seed 10 users (adjust as needed)
    await seedEquipment(20);   // Seed 20 equipment records

    console.log('Seeding completed');
  } catch (error) {
    console.error('Error in seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
}

runSeeders();
