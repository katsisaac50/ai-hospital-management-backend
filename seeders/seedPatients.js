// // seeders/patientSeeder.js
// const mongoose = require('mongoose');
// const path = require('path');
// require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// const Counter = require('../models/Counter');
// const Patient = require('../models/patient.model');

// // Verify environment variables
// if (!process.env.MONGO_URI) {
//   console.error('Error: MONGODB_URI not found in .env file');
//   process.exit(1);
// }

// // Sample patient data that matches your schema
// const samplePatients = [
//   {
//     name: 'Sarah Johnson',
//     firstName: 'Sarah',
//     lastName: 'Johnson',
//     dateOfBirth: new Date('1985-05-15'),
//     gender: 'female',
//     bloodType: 'A+',
//     address: {
//       street: '123 Main St',
//       city: 'Anytown',
//       state: 'CA',
//       postalCode: '90210',
//       country: 'USA'
//     },
//     phone: '+15551234567',
//     email: 'sarah.johnson@example.com',
//     emergencyContact: {
//       name: 'John Johnson',
//       relationship: 'spouse',
//       phone: '+15557654321'
//     },
//     emergencyPhone: '+15557654321',
//     medicalHistory: [
//       {
//         condition: 'Hypertension',
//         diagnosedAt: new Date('2018-03-10'),
//         notes: 'Controlled with medication'
//       }
//     ],
//     allergies: ['Penicillin'],
//     currentMedications: [
//       {
//         name: 'Lisinopril',
//         dosage: '10mg',
//         frequency: 'daily'
//       }
//     ],
//     insurance: {
//       provider: 'BlueCross',
//       policyNumber: 'BC123456789',
//       validUntil: new Date('2025-12-31')
//     },
//     status: 'active'
//   },
//   {
//     name: 'Michael Chen',
//     firstName: 'Michael',
//     lastName: 'Chen',
//     dateOfBirth: new Date('1990-08-22'),
//     gender: 'male',
//     bloodType: 'B+',
//     address: {
//       street: '456 Oak Ave',
//       city: 'Somewhere',
//       state: 'NY',
//       postalCode: '10001',
//       country: 'USA'
//     },
//     phone: '+15552345678',
//     email: 'michael.chen@example.com',
//     emergencyContact: {
//       name: 'Lisa Chen',
//       relationship: 'spouse',
//       phone: '+15558765432'
//     },
//     emergencyPhone: '+15558765432',
//     medicalHistory: [
//       {
//         condition: 'Type 2 Diabetes',
//         diagnosedAt: new Date('2020-05-15'),
//         notes: 'Diet controlled'
//       }
//     ],
//     currentMedications: [
//       {
//         name: 'Metformin',
//         dosage: '500mg',
//         frequency: 'twice daily'
//       }
//     ],
//     insurance: {
//       provider: 'Aetna',
//       policyNumber: 'AE987654321',
//       validUntil: new Date('2024-12-31')
//     },
//     status: 'active'
//   },
//   {
//     name: 'Emily Rodriguez',
//     firstName: 'Emily',
//     lastName: 'Rodriguez',
//     dateOfBirth: new Date('1978-11-30'),
//     gender: 'female',
//     bloodType: 'O-',
//     address: {
//       street: '789 Pine Rd',
//       city: 'Nowhere',
//       state: 'TX',
//       postalCode: '75001',
//       country: 'USA'
//     },
//     phone: '+15553456789',
//     email: 'emily.rodriguez@example.com',
//     emergencyContact: {
//       name: 'Carlos Rodriguez',
//       relationship: 'spouse',
//       phone: '+15559876543'
//     },
//     emergencyPhone: '+15559876543',
//     allergies: ['Shellfish', 'Latex'],
//     medicalHistory: [
//       {
//         condition: 'Asthma',
//         diagnosedAt: new Date('2015-07-20'),
//         notes: 'Mild intermittent'
//       }
//     ],
//     currentMedications: [
//       {
//         name: 'Albuterol',
//         dosage: '90mcg',
//         frequency: 'as needed'
//       }
//     ],
//     insurance: {
//       provider: 'UnitedHealth',
//       policyNumber: 'UH456789123',
//       validUntil: new Date('2023-12-31')
//     },
//     status: 'active'
//   }
// ];

// const seedPatients = async () => {
//   try {
//     console.log('Connecting to MongoDB...');
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });

//     console.log('Connected to MongoDB');

//     // Clear existing data
//     console.log('Clearing existing data...');
//     await mongoose.connection.dropDatabase();
//     console.log('Database cleared');

//     // Initialize counter
//     console.log('Initializing patient MRN counter...');
//     await Counter.deleteMany({ id: 'patient_mrn' });
//     await Counter.create({ id: 'patient_mrn', seq: 0 });
//     console.log('Patient MRN counter initialized');

//     // Seed patients
//     console.log('Seeding patients...');
//     const createdPatients = await Patient.insertMany(samplePatients);
//     console.log(`Seeded ${createdPatients.length} patients`);

//     // Display results
//     console.log('\nSeeding completed successfully:');
//     createdPatients.forEach(patient => {
//       console.log(`- ${patient.name} (MRN: ${patient.medicalRecordNumber}, Email: ${patient.email})`);
//       console.log(`  Address: ${patient.getFullAddress()}`);
//       console.log(`  Status: ${patient.status}, Last Visit: ${patient.lastVisit || 'Never'}`);
//     });

//     await mongoose.disconnect();
//     console.log('\nDisconnected from MongoDB');
//     process.exit(0);
//   } catch (error) {
//     console.error('\nError seeding data:', error);
//     process.exit(1);
//   }
// };

// seedPatients();




const faker = require("@faker-js/faker").faker;
const Patient = require("../models/patient.model");

const seedPatients = async () => {
  await Patient.deleteMany();

  const patients = [];

  for (let i = 0; i < 50; i++) {

    const medicalHistoryCount = faker.number.int({ min: 0, max: 3 });
    const medicalHistory = [];
    for (let j = 0; j < medicalHistoryCount; j++) {
      medicalHistory.push({
        condition: faker.lorem.words(faker.number.int({ min: 1, max: 3 })),
        diagnosedAt: faker.date.past(5),
        notes: faker.lorem.sentence(),
      });
    }

    const patient = new Patient({
      name: faker.person.fullName(),
      dateOfBirth: faker.date.past({ years: 30 }),
      gender: faker.helpers.arrayElement(["male", "female", "other"]),
      phone: faker.number.int({ min: 1000000000, max: 9999999999 }).toString(),
      email: faker.internet.email(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: faker.location.country(),
        postalCode: faker.location.zipCode(),
      },
      medicalHistory,
      bloodType: faker.helpers.arrayElement(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
      lastVisit: faker.date.recent({ days: 30 }),
      createdAt: faker.date.between({ from: "2024-01-01", to: "2024-12-31" }),
    });

    await patient.save();
    patients.push(patient);
  }

  console.log(`✅ Seeded ${patients.length} patients.`);
  return patients;
};

module.exports = seedPatients;
