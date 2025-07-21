const { faker } = require("@faker-js/faker");
const LabTest = require("../models/labTest.model");
const Patient = require("../models/patient.model");

const seedLabTests = async (count = 30) => {
  const patients = await Patient.find();

  if (patients.length === 0) {
    throw new Error("Seed patients first.");
  }

  const tests = ["CBC", "Liver Panel", "Blood Glucose", "Urinalysis", "COVID-19 PCR"];

  const labTests = [];

  for (let i = 0; i < count; i++) {
    labTests.push({
      patient: faker.helpers.arrayElement(patients)._id,
      testName: faker.helpers.arrayElement(tests),
      sampleType: faker.helpers.arrayElement(["Blood", "Urine", "Saliva"]),
      result: faker.helpers.arrayElement(["Normal", "Abnormal"]),
      status: "completed",
      referenceRange: "N/A",
      createdAt: faker.date.past({ years: 1 }),
    });
  }

  await LabTest.insertMany(labTests);
  console.log(`${count} lab tests seeded.`);
};

module.exports = seedLabTests;
