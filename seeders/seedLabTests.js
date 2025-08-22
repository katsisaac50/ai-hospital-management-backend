require("dotenv").config();
const mongoose = require("mongoose");
const LabTest = require("../models/labTest.model");
const Patient = require("../models/patient.model");
const User = require("../models/user.model");
const Counter = require("../models/Counter"); // for lab number sequencing
const { faker } = require("@faker-js/faker");

const categories = ['hematology', 'biochemistry', 'microbiology', 'pathology', 'radiology'];
const priorities = ['routine', 'urgent', 'stat'];
const statuses = ['pending', 'in_progress', 'completed'];

const testTypes = {
  hematology: ['Complete Blood Count', 'Hemoglobin', 'Platelet Count'],
  biochemistry: ['Liver Function Test', 'Blood Glucose', 'Cholesterol'],
  microbiology: ['Urine Culture', 'Stool Culture', 'COVID-19 PCR'],
  pathology: ['Biopsy', 'Cytology'],
  radiology: ['Chest X-Ray', 'MRI', 'CT Scan']
};

async function getNextLabNumber() {
  const counter = await Counter.findOneAndUpdate(
    { id: "lab_lrn" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `LAB${String(counter.seq).padStart(4, "0")}`;
}

const seedLabTests = async (count = 30) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const patients = await Patient.find();
    const users = await User.find();

    if (!patients.length) {
      console.warn("⚠️ No patients found in DB. Cannot seed lab tests.");
      return process.exit(1);
    }
    if (!users.length) {
      console.warn("⚠️ No users found in DB. Cannot seed lab tests.");
      return process.exit(1);
    }

    for (let i = 0; i < count; i++) {
      const patient = faker.helpers.arrayElement(patients);
      const user = faker.helpers.arrayElement(users);
      const category = faker.helpers.arrayElement(categories);
      const testType = faker.helpers.arrayElement(testTypes[category]);
      const labNumber = await getNextLabNumber();

      const labTest = new LabTest({
        patientId: patient._id,
        patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
        LaboratoryRecordNumber: labNumber,
        testType,
        orderedBy: user.name || user.email,
        orderedById: user._id,
        priority: faker.helpers.arrayElement(priorities),
        status: faker.helpers.arrayElement(statuses),
        orderDate: faker.date.past({ years: 1 }),
        results: faker.helpers.arrayElement([
          { result: "Normal", details: faker.lorem.sentence() },
          { result: "Abnormal", details: faker.lorem.sentence() },
          null,
        ]),
        technicianNotes: faker.lorem.sentence(),
        completedDate: faker.date.recent({ days: 30 }),
        category,
        description: faker.lorem.sentence(),
        price: faker.number.int({ min: 20, max: 200 }),
        turnaroundTime: faker.number.int({ min: 1, max: 72 }),
        sampleType: faker.helpers.arrayElement(['blood', 'urine', 'saliva', 'tissue']),
        preparationInstructions: faker.lorem.sentence(),
        isActive: true,
        createdAt: faker.date.past({ years: 1 }),
        updatedAt: new Date(),
      });

      await labTest.save();
    }

    console.log(`✅ Successfully seeded ${count} lab tests.`);
    process.exit(0);
  } catch (err) {
    console.error("Seeder error:", err);
    process.exit(1);
  }
};

seedLabTests();






// const { faker } = require("@faker-js/faker");
// const LabTest = require("../models/labTest.model");
// const Patient = require("../models/patient.model");
// const User = require("../models/user.model");

// const categories = ['hematology', 'biochemistry', 'microbiology', 'pathology', 'radiology'];
// const priorities = ['routine', 'urgent', 'stat'];
// const statuses = ['pending', 'in_progress', 'completed'];

// const seedLabTests = async (count = 30) => {
//   const patients = await Patient.find();
//   const users = await User.find();

//   if (!patients.length) {
//     console.warn("⚠️ No patients found in DB. Cannot seed lab tests.");
//     return;
//   }

//   if (!users.length) {
//     console.warn("⚠️ No users found in DB. Cannot seed lab tests.");
//     return;
//   }

//   const testTypes = {
//     hematology: ['Complete Blood Count', 'Hemoglobin', 'Platelet Count'],
//     biochemistry: ['Liver Function Test', 'Blood Glucose', 'Cholesterol'],
//     microbiology: ['Urine Culture', 'Stool Culture', 'COVID-19 PCR'],
//     pathology: ['Biopsy', 'Cytology'],
//     radiology: ['Chest X-Ray', 'MRI', 'CT Scan']
//   };

//   const labTests = [];

//   for (let i = 0; i < count; i++) {
//     const patient = faker.helpers.arrayElement(patients);
//     const user = faker.helpers.arrayElement(users);
//     const category = faker.helpers.arrayElement(categories);
//     const testType = faker.helpers.arrayElement(testTypes[category]);

//     labTests.push({
//       patientId: patient._id,
//       patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
//       testType,
//       orderedBy: user.name || user.email,
//       orderedById: user._id,
//       priority: faker.helpers.arrayElement(priorities),
//       status: faker.helpers.arrayElement(statuses),
//       orderDate: faker.date.past({ years: 1 }),
//       results: faker.helpers.arrayElement([
//         { result: "Normal", details: faker.lorem.sentence() },
//         { result: "Abnormal", details: faker.lorem.sentence() },
//         null
//       ]),
//       technicianNotes: faker.lorem.sentence(),
//       completedDate: faker.date.recent({ days: 30 }),
//       category,
//       description: faker.lorem.sentence(),
//       price: faker.number.int({ min: 20, max: 200 }), // updated faker syntax
//       turnaroundTime: faker.number.int({ min: 1, max: 72 }),
//       sampleType: faker.helpers.arrayElement(['blood', 'urine', 'saliva', 'tissue']),
//       preparationInstructions: faker.lorem.sentence(),
//       isActive: true,
//       createdAt: faker.date.past({ years: 1 }),
//       updatedAt: new Date(),
//     });
//   }

//   await LabTest.insertMany(labTests);
//   console.log(`✅ ${count} lab tests seeded with existing patients & users.`);
// };

// module.exports = seedLabTests;
