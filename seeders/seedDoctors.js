const { faker } = require('@faker-js/faker');
const Doctor = require("../models/doctor.model");

const DEPARTMENTS = ['emergency', 'cardiology', 'neurology', 'pediatrics'];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const SPECIALIZATIONS = ['cardiology', 'neurology', 'pediatrics', 'orthopedics', 'general surgery'];

const generateSchedule = () => {
  return WEEK_DAYS.map(day => ({
    day,
    startTime: '08:00',
    endTime: '16:00',
    isAvailable: faker.datatype.boolean(),
  }));
};

const seedDoctors = async () => {
  await Doctor.deleteMany();
  const doctors = [];
  


  for (let i = 0; i < 20; i++) {
    const doctor = new Doctor({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      specializations: [faker.helpers.arrayElement(SPECIALIZATIONS)], // You can change this to a specific set if needed
      department: faker.helpers.arrayElement(DEPARTMENTS),
      licenseNumber: `DOC-${faker.number.int({ min: 10000, max: 99999 })}`,
      phone: faker.number.int({ min: 1000000000, max: 9999999999 }).toString(),
      email: `dr.${faker.internet.username().toLowerCase()}@hospital.com`,
      schedule: generateSchedule(),
      isActive: faker.datatype.boolean(),
    });

    const saved = await doctor.save();
    doctors.push(saved);
  }

  console.log(`✅ Seeded ${doctors.length} doctors.`);
  return doctors;
};

module.exports = seedDoctors;
