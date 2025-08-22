// seeders/seedUsers.js
const { faker } = require('@faker-js/faker');
const User = require('../models/user.model'); // adjust path if needed

const seedUsers = async (count = 10) => {
  // Optionally clear existing users before seeding
  await User.deleteMany({});

  const users = [];

  for (let i = 0; i < count; i++) {
    users.push({
        name: faker.person.fullName(),
      fullName: faker.name.fullName(),
      email: faker.internet.email(),
      role: 'lab_technician',  // or adjust roles as needed
      password: 'password123', // in production hash this!
      phoneNumber: faker.phone.number(),
      createdAt: faker.date.past(1),
      updatedAt: new Date(),
    });
  }

  await User.insertMany(users);
  console.log(`${count} users seeded.`);
};

module.exports = seedUsers;
