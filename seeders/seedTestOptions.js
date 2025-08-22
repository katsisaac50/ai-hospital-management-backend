const mongoose = require("mongoose");
const TestOption = require("../models/testOption.model");

const testOptionsData = [
  {
    category: "hematology",
    testTypes: ["Complete Blood Count", "Hemoglobin", "Platelet Count"],
    sampleTypes: ["Blood"],
  },
  {
    category: "biochemistry",
    testTypes: ["Blood Glucose", "Cholesterol", "Liver Function Test"],
    sampleTypes: ["Blood", "Urine"],
  },
  {
    category: "microbiology",
    testTypes: ["Urine Culture", "Throat Swab", "Blood Culture"],
    sampleTypes: ["Urine", "Blood", "Saliva"],
  },
  {
    category: "pathology",
    testTypes: ["Biopsy", "Pap Smear"],
    sampleTypes: ["Tissue"],
  },
  {
    category: "radiology",
    testTypes: ["X-ray", "MRI", "CT Scan"],
    sampleTypes: ["Other"],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://linkzaman:LovE1234k@cluster0.encegx7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
    await TestOption.deleteMany({});
    await TestOption.insertMany(testOptionsData);
    console.log("Test options seeded");
    mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
}

seed();
