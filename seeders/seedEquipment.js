const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Equipment = require('../models/equipment.model'); // Adjust path as needed
const User = require('../models/user.model'); // To assign technicianInCharge

const statuses = ['online', 'in_use', 'maintenance', 'offline'];
const locations = ['Lab A', 'Lab B', 'Storage Room', 'Main Building'];

async function seedEquipment(count = 20) {
  try {
    // Get users to assign technicians randomly
    const users = await User.find();

    if (users.length === 0) {
      throw new Error('No users found to assign as technicianInCharge. Seed users first.');
    }

    const equipmentData = [];

    for (let i = 0; i < count; i++) {
      const lastMaintenanceDate = faker.date.past(1);
      const nextMaintenanceDate = faker.date.soon(30, lastMaintenanceDate);

      equipmentData.push({
        name: faker.commerce.productName(),
        model: faker.string.alphanumeric(8).toUpperCase(),
        status: faker.helpers.arrayElement(statuses),
        lastMaintenance: lastMaintenanceDate,
        nextMaintenance: nextMaintenanceDate,
        location: faker.helpers.arrayElement(locations),
        technicianInCharge: faker.helpers.arrayElement(users)._id,
        testsToday: faker.number.int({ min: 0, max: 20 }),
        isActive: true
      });
    }

    await Equipment.insertMany(equipmentData);
    console.log(`Seeded ${count} equipment records successfully.`);
  } catch (err) {
    console.error('Error seeding equipment:', err);
  }
}

module.exports = seedEquipment;
