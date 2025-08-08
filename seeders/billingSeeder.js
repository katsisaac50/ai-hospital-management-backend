// seeders/billingSeeder.js

// insertBillingData.js
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
require('dotenv').config();
const Billing = require('../models/billing.model');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected")
    return insertBillingData()
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message)
    process.exit(1)
  })

async function insertBillingData() {
  try {
    // await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const billingData = [
    {
      "patient": new ObjectId("687f93d4e72e800a0c39c035"),
      "invoiceNumber": "INV-2025-0122",
      "date": new Date("2025-07-09T22:00:00.000Z"),
      "dueDate": new Date("2025-08-09T22:00:00.000Z"),
      "items": [
        {
          "description": "MRI Scan",
          "quantity": 1,
          "unitPrice": 900,
          "amount": 900
        },
        {
          "description": "Consultation",
          "quantity": 2,
          "unitPrice": 254,
          "amount": 508
        }
      ],
      "subtotal": 1408,
      "tax": 70.4,
      "discount": 28.16,
      "total": 1450.24,
      "currency": "USD",
      "paymentStatus": "paid",
      "status": "paid",
      "payments": [
        {
          "amount": 1450.24,
          "method": "insurance",
          "date": new Date("2025-07-09T22:00:00.000Z"),
          "transactionId": "PAY123456"
        }
      ],
      "insuranceClaim": {
        "isClaimed": true,
        "claimAmount": 1450.24,
        "claimStatus": "approved"
      },
      "createdBy": new ObjectId("687f93d4e72e800a0c39c02b")
    },
    {
      "patient": new ObjectId("687f93d4e72e800a0c39c02f"),
      "invoiceNumber": "INV-2025-0123",
      "date": new Date("2025-07-03T22:00:00.000Z"),
      "dueDate": new Date("2025-08-03T22:00:00.000Z"),
      "items": [
        {
          "description": "Blood Test",
          "quantity": 1,
          "unitPrice": 120,
          "amount": 120
        },
        {
          "description": "X-Ray",
          "quantity": 1,
          "unitPrice": 360,
          "amount": 360
        }
      ],
      "subtotal": 480,
      "tax": 24,
      "discount": 48,
      "total": 456,
      "currency": "USD",
      "paymentStatus": "pending",
      "status": "overdue",
      "payments": [],
      "insuranceClaim": {
        "isClaimed": false
      },
      "createdBy": new ObjectId("687f93d4e72e800a0c39c02b")
    },
    {
      "patient": new ObjectId("687f93d4e72e800a0c39c02f"),
      "invoiceNumber": "INV-2025-0124",
      "date": new Date("2025-07-15T22:00:00.000Z"),
      "dueDate": new Date("2025-08-15T22:00:00.000Z"),
      "items": [
        {
          "description": "General Consultation",
          "quantity": 1,
          "unitPrice": 60,
          "amount": 60
        }
      ],
      "subtotal": 60,
      "tax": 3,
      "discount": 6,
      "total": 57,
      "currency": "USD",
      "paymentStatus": "partial",
      "status": "overdue",
      "payments": [
        {
          "amount": 28.5,
          "method": "card",
          "date": new Date("2025-07-15T22:00:00.000Z"),
          "transactionId": "PAY789012"
        }
      ],
      "insuranceClaim": {
        "isClaimed": false
      },
      "createdBy": new ObjectId("687f93d4e72e800a0c39c02b")
    },
    {
      "patient": new ObjectId("687f93d4e72e800a0c39c035"),
      "invoiceNumber": "INV-2025-0125",
      "date": new Date("2025-07-09T22:00:00.000Z"),
      "dueDate": new Date("2025-08-09T22:00:00.000Z"),
      "items": [
        {
          "description": "Physical Therapy",
          "quantity": 4,
          "unitPrice": 317,
          "amount": 1268
        }
      ],
      "subtotal": 1268,
      "tax": 63.4,
      "discount": 177.52,
      "total": 1153.88,
      "currency": "USD",
      "paymentStatus": "pending",
      "status": "overdue",
      "payments": [],
      "insuranceClaim": {
        "isClaimed": true,
        "claimAmount": 1153.88,
        "claimStatus": "submitted"
      },
      "createdBy": new ObjectId("687f93d4e72e800a0c39c02b")
    }
];

    const result = await Billing.insertMany(billingData);
    console.log(`${result.length} billing records inserted`);
    process.exit(0);
  } catch (error) {
    console.error('Error inserting billing data:', error);
    process.exit(1);
  }
}

insertBillingData();








// const mongoose = require('mongoose');
// const Billing = require('../models/billing.model');
// const Counter = require('../models/Counter');
// const Patient = require('../models/patient.model');
// const User = require('../models/user.model');
// require('dotenv').config();

// if (!process.env.MONGO_URI) {
//   console.error('Error: MONGODB_URI not found in .env file');
//   process.exit(1);
// }

// // Sample data - Modified to work with your actual models
// const sampleUsers = [
//   {
//     name: 'Admin User',
//     email: 'admin@clinic.com',
//     role: 'admin',
//     password: '$2a$10$examplehashedpassword' // Add hashed password
//   },
//   {
//     name: 'Billing Staff',
//     email: 'billing@clinic.com',
//     role: 'doctor',
//     password: '$2a$10$examplehashedpassword' // Add hashed password
//   }
// ];

// const seedBillingData = async () => {
//   try {
//     // Connect to MongoDB
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });

//     console.log('Connected to MongoDB');

//     // Clear existing data
//     console.log('Clearing existing data...');
//     await mongoose.connection.dropDatabase();
//     console.log('Database cleared');

//     // Initialize counters
//     console.log('Initializing counters...');
//     await Counter.create([
//       { id: 'invoiceNumber', seq: 0 },
//       { id: 'patient_mrn', seq: 0 }
//     ]);
//     console.log('Counters initialized');

//     // Seed users first since they're referenced in invoices
//     console.log('Seeding users...');
//     const users = await User.insertMany(sampleUsers);
//     console.log(`Seeded ${users.length} users`);

//     // Sample patients data - now properly structured for your model
//     // Sample data
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


//     // Seed patients
//     console.log('Seeding patients...');
//     const patients = await Patient.insertMany(samplePatients);
//     console.log(`Seeded ${patients.length} patients`);

//      // Generate invoice numbers
//     const invoiceCounter = await Counter.findOneAndUpdate(
//       { id: 'invoiceNumber' },
//       { $inc: { seq: patients.length } },
//     );

//     const invoiceNumbers = [];
//     for (let i = 0; i < patients.length; i++) {
//       invoiceNumbers.push(`INV-${new Date().getFullYear()}-${invoiceCounter.seq - patients.length + i + 1}`);
//     }

//     // Now create invoices with proper references
//     const sampleInvoices = [
//       {
//         invoiceNumber: invoiceNumbers[0],
//         patient: patients[0]._id,
//         patientName: patients[0].name,
//         date: new Date('2024-01-15'),
//         dueDate: new Date('2024-02-14'),
//         items: [
//           {
//             description: 'Consultation',
//             quantity: 1,
//             unitPrice: 200.00,
//             amount: 200.00
//           }
//         ],
//         subtotal: 200.00,
//         total: 200.00,
//         currency: 'USD',
//         paymentStatus: 'paid',
//         status: 'paid',
//         createdBy: users[0]._id
//       },
//       {
//         invoiceNumber: invoiceNumbers[1],
//         patient: patients[1]._id,
//         patientName: patients[1].name,
//         date: new Date('2024-01-14'),
//         dueDate: new Date('2024-02-13'),
//         items: [
//           {
//             description: 'MRI Scan',
//             quantity: 1,
//             unitPrice: 900.00,
//             amount: 900.00
//           }
//         ],
//         subtotal: 900.00,
//         total: 900.00,
//         currency: 'USD',
//         paymentStatus: 'pending',
//         status: 'sent',
//         createdBy: users[1]._id
//       }
//     ];


//     // Seed invoices
//     console.log('Seeding invoices...');
//     const invoices = await Billing.insertMany(sampleInvoices);
//     console.log(`Seeded ${invoices.length} invoices`);

//     // Display results
//     console.log('\nSeeding completed successfully!');
//     console.log('Patients:');
//     patients.forEach(p => console.log(`- ${p.name} (MRN: ${p.medicalRecordNumber})`));
    
//     console.log('\nInvoices:');
//     invoices.forEach(i => console.log(`- ${i.invoiceNumber}: $${i.total} for ${i.patientName}`));

//     await mongoose.disconnect();
//     process.exit(0);
//   } catch (error) {
//     console.error('Error seeding data:', error);
//     process.exit(1);
//   }
// };

// seedBillingData();