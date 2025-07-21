const mongoose = require("mongoose");
require("dotenv").config();

const seedPatients = require("./seedPatients");
const seedAppointments = require("./seedAppointments");
const seedLabTests = require("./seedLabTests");
const seedDoctors = require("./seedDoctors");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital-db";

async function seedAll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear previous data
    await Promise.all([
      require("../models/patient.model").deleteMany(),
      require("../models/appointment.model").deleteMany(),
      require("../models/labTest.model").deleteMany(),
    ]);
    console.log("Cleared old data");

    const patients = await seedPatients(50);
    console.log(`Seeded ${patients} patients.`);
    const doctors = await seedDoctors(10);

    if (!patients || !patients.length) {
      throw new Error('No patients seeded.');
    }
    if (!doctors || !doctors.length) {
      throw new Error('No doctors seeded.');
    }
    
    await seedAppointments(doctors, patients);
    await seedLabTests(patients);

    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    mongoose.disconnect();
  }
}

seedAll();
