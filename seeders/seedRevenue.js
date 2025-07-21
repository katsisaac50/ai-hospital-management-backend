// seeders/seedRevenue.js
const mongoose = require('mongoose');
const Billing = require('../models/billing.model');
const Patient = require('../models/patient.model');
const faker = require('@faker-js/faker').faker;

const seedRevenueData = async () => {
  try {
    // await mongoose.connect('mongodb://127.0.0.1:27017/hospital_db'); // update if needed
console.log('jalia');
    const patients = await Patient.find();
    if (patients.length === 0) throw new Error('No patients found');

    await Billing.deleteMany({});

    const generateBills = (count, isThisMonth = true) => {
      const bills = [];
      for (let i = 0; i < count; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (isThisMonth ? 0 : 1));
        date.setDate(faker.number.int({ min: 1, max: 28 }));

        const quantity = faker.number.int({ min: 1, max: 4 });
        const unitPrice = faker.number.int({ min: 50, max: 400 });
        const amount = quantity * unitPrice;
        const tax = amount * 0.05;
        const discount = faker.number.int({ min: 0, max: 50 });

        const subtotal = amount;
        const total = subtotal + tax - discount;

        bills.push({
          patient: faker.helpers.arrayElement(patients)._id,
          invoiceNumber: `INV-${faker.number.int({ min: 10000, max: 99999 })}`,
          date,
          items: [
            {
              description: faker.commerce.product(),
              quantity,
              unitPrice,
              amount,
            },
          ],
          subtotal,
          tax,
          discount,
          total,
          paymentStatus: faker.helpers.arrayElement(['paid', 'partial', 'pending']),
          payments: [
            {
              amount: total,
              method: faker.helpers.arrayElement(['cash', 'card', 'insurance']),
              date,
              transactionId: faker.string.uuid(),
            },
          ],
        });
      }
      return bills;
    };

    const thisMonthBills = generateBills(60, true);
    const lastMonthBills = generateBills(40, false);

    await Billing.insertMany([...thisMonthBills, ...lastMonthBills]);

    console.log('✅ Seeded revenue billing data!');
    process.exit();
  } catch (error) {
    console.error('Error seeding billing:', error);
    process.exit(1);
  }
};

// seedRevenueData();

module.exports = seedRevenueData;