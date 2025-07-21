const Appointment = require('../models/appointment.model'); // Make sure the path is correct!
const { faker } = require('@faker-js/faker');

function getNextWeekdayDate(dayOfWeek) {
  const today = new Date();
  const day = today.getDay();
  const diff = (dayOfWeek + 7 - day) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + diff + 1);
  return date;
}

module.exports = async function seedAppointments(doctors, patients) {
  await Appointment.deleteMany();

  const appointments = [];

  for (let i = 0; i < 30; i++) {
    const doctor = faker.helpers.arrayElement(doctors);
    const patient = faker.helpers.arrayElement(patients);

    const availableSlot = doctor.schedule.find(slot => slot.isAvailable);
    if (!availableSlot) continue;

    const weekdayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(availableSlot.day);
    const appointmentDate = getNextWeekdayDate(weekdayIndex);

    const appointment = new Appointment({
      doctor: doctor._id,
      patient: patient._id,
      reason: faker.lorem.words(5),
      date: appointmentDate,
      time: availableSlot.startTime,
      scheduleSlot: {
        day: availableSlot.day,
        startTime: availableSlot.startTime,
        endTime: availableSlot.endTime,
      },
      duration: 30,
      status: 'scheduled',
      notes: faker.lorem.sentence(),
    });

    await appointment.save();
    appointments.push(appointment);
  }

  console.log(`✅ Seeded ${appointments.length} appointments.`);
  return appointments;
};
