function randomTime(startHour, endHour) {
  const hour = Math.floor(Math.random() * (endHour - startHour)) + startHour;
  const minute = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function generateDynamicSchedule() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const schedule = [];

  days.forEach(day => {
    // Randomly decide if doctor is working this day
    const isWorking = Math.random() > 0.2;
    if (isWorking) {
      const startTime = randomTime(7, 10); // Start between 7:00 and 10:00
      const endTime = randomTime(16, 20); // End between 16:00 and 20:00

      // Make sure start < end, else swap
      let s = startTime, e = endTime;
      if (startTime >= endTime) [s, e] = [e, s];

      schedule.push({
        day,
        startTime: s,
        endTime: e,
        isAvailable: true,
        capacity: Math.floor(Math.random() * 6) + 3, // capacity 3-8 patients
      });
    } else {
      schedule.push({
        day,
        startTime: '00:00',
        endTime: '00:00',
        isAvailable: false,
        capacity: 0,
      });
    }
  });

  return schedule;
}
