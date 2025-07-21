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
