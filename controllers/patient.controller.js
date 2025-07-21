const Patient = require('../models/patient.model');
const Appointment = require('../models/appointment.model');
const Billing = require('../models/billing.model')
const Doctor = require('../models/doctor.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const OperatingRoom = require('../models/operatingRoom.model');

// @desc    Get all patients
// @route   GET /api/v1/patients
// @access  Private
exports.getPatients = asyncHandler(async (req, res, next) => {
  console.log('hello hgfd', res.advancedResults)
  res.status(200).json(res.advancedResults);
});

// @desc    Get single patient
// @route   GET /api/v1/patients/:id
// @access  Private
exports.getPatient = asyncHandler(async (req, res, next) => {
  
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return next(
      new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: patient,
  });
});

// @desc    Create new patient
// @route   POST /api/v1/patients
// @access  Private
exports.createPatient = asyncHandler(async (req, res, next) => {
  console.log('here is the body', req.body);
  const patient = await Patient.create(req.body);

  res.status(201).json({
    success: true,
    data: patient,
  });
});

// @desc    Update patient
// @route   PUT /api/v1/patients/:id
// @access  Private
exports.updatePatient = asyncHandler(async (req, res, next) => {
  console.log("status to update:", req.body.status)
  const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!patient) {
    return next(
      new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404)
    );
  }
console.log("status to update:", patient)
  res.status(200).json({
    success: true,
    data: patient,
  });
});

// @desc    Delete patient
// @route   DELETE /api/v1/patients/:id
// @access  Private
exports.deletePatient = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);

  if (!patient) {
    return next(
      new ErrorResponse(`Patient not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get patient stats
// @route   GET /api/v1/patients/stats
// @access  Private
exports.getPatientStats = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const today = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
const currentHour = now.getHours()

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setDate(startOfWeek.getDate() - 1); // Saturday


    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalICUBeds = 16;

    const totalPatients = await Patient.countDocuments();
    const criticalPatientsCount = await Patient.countDocuments({ status: 'critical' })
    const occupiedICUBeds = await Patient.countDocuments({ admittedTo: 'ICU' });

    const totalOR = await OperatingRoom.countDocuments();
    const availableOR = await OperatingRoom.countDocuments({ isAvailable: true });

    const todayCount = await Patient.countDocuments({ createdAt: { $gte: startOfToday } });
    const yesterdayCount = await Patient.countDocuments({
      createdAt: { $gte: startOfYesterday, $lt: startOfToday },
    });

    const thisWeekCount = await Patient.countDocuments({ createdAt: { $gte: startOfWeek } });
    const lastWeekCount = await Patient.countDocuments({
      createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek },
    });

    const thisMonthCount = await Patient.countDocuments({ createdAt: { $gte: startOfMonth } });
    const lastMonthCount = await Patient.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const last7Days = [];
for (let i = 6; i >= 0; i--) {
  const day = new Date(now);
  day.setDate(now.getDate() - i);
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);

  last7Days.push({
    date: startOfDay.toISOString().slice(0, 10), // YYYY-MM-DD
    count: await Patient.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } }),
  });
}

const [todaysAppointments, pendingAppointments] = await Promise.all([
  Appointment.countDocuments({ date: { $gte: startOfToday, $lte: endOfToday } }),
  Appointment.countDocuments({
    date: { $gte: startOfToday, $lte: endOfToday },
    status: 'scheduled'
  }),
])

const activeDoctors = await Doctor.find({ isActive: true })

const onDutyDoctors = activeDoctors.filter(doc =>
  doc.schedule.some(slot => {
    if (!slot.isAvailable || slot.day !== today) return false
    const [startH] = slot.startTime.split(':').map(Number)
    const [endH] = slot.endTime.split(':').map(Number)
    return currentHour >= startH && currentHour < endH
  })
)

const thisMonthRevenueAgg = await Billing.aggregate([
  { $unwind: "$payments" },
  { $match: { "payments.date": { $gte: startOfMonth } } },
  { $group: { _id: null, total: { $sum: "$payments.amount" } } },
])

const lastMonthRevenueAgg = await Billing.aggregate([
  { $unwind: "$payments" },
  {
    $match: {
      "payments.date": {
        $gte: startOfLastMonth,
        $lte: endOfLastMonth,
      },
    },
  },
  { $group: { _id: null, total: { $sum: "$payments.amount" } } },
])

const monthlyRevenue = thisMonthRevenueAgg[0]?.total || 0
const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0
const revenueGrowth = lastMonthRevenue
  ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
  : 0
let revenueTrend = 'flat'
if (monthlyRevenue > lastMonthRevenue) revenueTrend = 'up'
else if (monthlyRevenue < lastMonthRevenue) revenueTrend = 'down'

console.log('numve', totalPatients, criticalPatientsCount)

    res.json({
      totalPatients,
      criticalPatientsCount,
      statsOR: {
        total: totalOR,
        available: availableOR
      },
      occupiedICUBeds: {
      occupied: occupiedICUBeds,
      total: totalICUBeds,
    },
      today: { count: todayCount, prev: yesterdayCount },
      week: { count: thisWeekCount, prev: lastWeekCount },
      month: { count: thisMonthCount, prev: lastMonthCount },
      last7Days,
      monthlyRevenue: {
    total: monthlyRevenue,
    growth: revenueGrowth.toFixed(1),
    trend: revenueTrend, // 'up' | 'down' | 'flat'
  },
      doctors: {
      totalActive: activeDoctors.length,
      currentlyOnDuty: onDutyDoctors.length,
    },
  appointmentsToday: {
    total: todaysAppointments,
    pending: pendingAppointments,
  }
    });
  } catch (err) {
    res.status(500).json({ message: "Stats fetch error", error: err.message });
  }
});

