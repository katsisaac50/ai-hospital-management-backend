const cron = require("node-cron");
const OperatingRoom = require("../models/operatingRoom.model");
const CronLog = require("../models/cronLog.model");

// Run every minute: adjust as needed
const startORAutoReleaseCron = () => {
  cron.schedule("* * * * *", async () => {
    console.log("⏱️ Running OR auto-release check...");

    const now = new Date();

    try {
      const expiredORs = await OperatingRoom.find({
        expectedRelease: { $lt: now },
        isAvailable: false,
        status: "occupied",
      });

      for (const or of expiredORs) {
        console.log(`🔓 Releasing OR: ${or.roomNumber}`);

        or.history.push({
          patient: or.currentPatient,
          doctor: or.assignedDoctor,
          surgeryType: or.notes || "Unspecified",
          startedAt: or.occupiedSince,
          endedAt: or.expectedRelease,
          notes: "Auto-released by cron",
        });

        or.isAvailable = true;
        or.status = "cleaning";
        or.currentPatient = null;
        or.assignedDoctor = null;
        or.occupiedSince = null;
        or.expectedRelease = null;

        await or.save();
      }

      console.log(`✅ Released ${expiredORs.length} OR(s).`);
    } catch (error) {
      console.error("❌ OR auto-release cron failed:", error);
    }
  });
};


const cleaningToAvailableCron = () => {
  cron.schedule("* * * * *", async () => {
    console.log("🧽 Checking cleaning ORs...");

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const cleaningORs = await OperatingRoom.find({
      status: "cleaning",
      lastCleanedAt: { $lt: thirtyMinsAgo },
    });

    for (const or of cleaningORs) {
      console.log(`✅ Marking OR ${or.roomNumber} as available`);

      or.status = "available";
      or.isAvailable = true;
      or.lastCleanedAt = null;

      await or.save();
    }

    try{
await CronLog.create({
  jobName: "or-cleaning-to-available",
  runAt: new Date(),
  details: `Freed ${cleaningORs.length} ORs`,
  success: true,
});
  } catch (error){
await CronLog.create({
  jobName: "or-cleaning-to-available",
  runAt: new Date(),
  success: false,
  error: error.message,
});
  }

    console.log(`🧽 Cleaning check complete. Freed ${cleaningORs.length} OR(s).`);

  });
  
};


module.exports = { startORAutoReleaseCron, cleaningToAvailableCron };
