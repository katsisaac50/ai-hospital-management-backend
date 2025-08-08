// seeders/seedRevenue.js
const mongoose = require('mongoose');
const Billing = require('../models/billing.model');
const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const Counter = require('../models/Counter');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

const seedRevenueData = async () => {
  let session;
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hospital_db');
    console.log('Connected to MongoDB');

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Verify we have patients and users
    const patients = await Patient.find().session(session);
    const users = await User.find({ role: { $in: ['admin', 'staff'] } }).session(session);
    
    if (patients.length === 0) throw new Error('No patients found');
    if (users.length === 0) throw new Error('No users found for createdBy reference');

    // Clear existing billing data
    console.log('Clearing existing billing data...');
    await Billing.deleteMany({}).session(session);

    // Get or create invoice counter
    let counter = await Counter.findOneAndUpdate(
      { id: 'invoiceNumber' },
      { $inc: { seq: 100 } },
      { new: true, upsert: true, session }
    ).session(session);

    const generateBills = (count, isCurrentMonth = true) => {
      const bills = [];
      const now = new Date();
      const year = now.getFullYear();
      
      for (let i = 0; i < count; i++) {
        const date = isCurrentMonth ? 
          new Date(year, now.getMonth(), faker.number.int({ min: 1, max: 28 })) :
          new Date(year, now.getMonth() - 1, faker.number.int({ min: 1, max: 28 }));
        
        const quantity = faker.number.int({ min: 1, max: 4 });
        const unitPrice = faker.number.int({ min: 50, max: 400 });
        const amount = quantity * unitPrice;
        const tax = amount * 0.05;
        const discount = amount * (faker.number.int({ min: 0, max: 15 }) / 100);
        const subtotal = amount;
        const total = subtotal + tax - discount;

        const paymentStatus = faker.helpers.arrayElement(['paid', 'partial', 'pending']);
        const payments = paymentStatus === 'paid' ? [{
          amount: total,
          method: faker.helpers.arrayElement(['cash', 'card', 'insurance', 'bank-transfer']),
          date,
          transactionId: faker.string.uuid(),
        }] : paymentStatus === 'partial' ? [{
          amount: total * 0.5,
          method: faker.helpers.arrayElement(['cash', 'card']),
          date,
          transactionId: faker.string.uuid(),
        }] : [];

        // Generate invoice number matching your schema pattern: INV-YYYY-XXXX
        const invoiceNumber = `INV-${year}-${String(counter.seq + i).padStart(4, '0')}`;

        bills.push({
          invoiceNumber,
          patient: faker.helpers.arrayElement(patients)._id,
          patientName: faker.helpers.arrayElement(patients).name,
          date,
          dueDate: new Date(date.getFullYear(), date.getMonth() + 1, date.getDate()),
          items: [{
            description: faker.helpers.arrayElement([
              'General Consultation',
              'Specialist Consultation',
              'Blood Test',
              'X-Ray',
              'MRI Scan',
              'Physical Therapy'
            ]),
            quantity,
            unitPrice,
            amount,
          }],
          subtotal,
          tax,
          discount,
          total,
          currency: 'USD',
          paymentStatus,
          payments,
          status: paymentStatus === 'paid' ? 'paid' : 
                 date < new Date() ? 'overdue' : 'sent',
          createdBy: faker.helpers.arrayElement(users)._id,
          insuranceProvider: faker.helpers.arrayElement([
            'BlueCross',
            'Aetna',
            'UnitedHealth',
            'Medicare'
          ]),
        });
      }
      return bills;
    };

    // Generate bills (60 current month, 40 previous month)
    const currentMonthBills = generateBills(60, true);
    const previousMonthBills = generateBills(40, false);

    // Insert all bills
    const createdBills = await Billing.insertMany(
      [...currentMonthBills, ...previousMonthBills],
      { session }
    );

    // Update counter with actual number of bills created
    await Counter.findOneAndUpdate(
      { id: 'invoiceNumber' },
      { $inc: { seq: createdBills.length } },
      { session }
    );

    await session.commitTransaction();
    console.log('✅ Successfully seeded revenue data!');
    console.log(`- ${currentMonthBills.length} current month bills`);
    console.log(`- ${previousMonthBills.length} previous month bills`);
    console.log(`- ${createdBills.filter(b => b.paymentStatus === 'paid').length} paid invoices`);
    console.log(`- $${createdBills.reduce((sum, bill) => sum + bill.total, 0).toFixed(2)} total revenue`);

  } catch (error) {
    if (session) await session.abortTransaction();
    console.error('❌ Error seeding revenue data:', error);
    process.exit(1);
  } finally {
    if (session) session.endSession();
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Uncomment to run directly
 seedRevenueData();

// module.exports = seedRevenueData;