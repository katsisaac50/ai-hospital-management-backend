const Appointment = require('../models/appointment.model');
const Patient = require('../models/patient.model');
const Doctor = require('../models/doctor.model');
const Billing = require('../models/billing.model'); // Assuming you have a billing model

exports.getDashboardStats = async (req, res) => {
  try {
    // Date calculations
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfThisMonth = new Date(currentYear, currentMonth, 1);
    const endOfThisMonth = new Date(currentYear, currentMonth + 1, 0);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0);

    const lastMonthStart = new Date(todayStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);

    const lastMonthEnd = new Date(todayStart);
    lastMonthEnd.setDate(0);

    // Main data fetching
    const [
      patientsData,
      doctorsData,
      appointmentsData,
      billingData,
      // criticalPatients
    ] = await Promise.all([
      // Patients data
      Promise.all([
        Patient.countDocuments(),
        Patient.countDocuments({ 
          status: 'active',
          lastVisit: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) }
        }),
        Patient.countDocuments({ status: 'critical' }),
        Patient.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
        Patient.countDocuments({
    createdAt: { 
      $gte: lastMonthStart,
      $lte: lastMonthEnd
    }
  })
      ]),

      // Doctors data
      Promise.all([
        Doctor.countDocuments({ isActive: true }),
        Doctor.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$department', count: { $sum: 1 } } }
        ]),
        Doctor.countDocuments({
          isActive: true,
          createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
        })
      ]),

      // Appointments data
      Promise.all([
        Appointment.find({ date: { $gte: weekStart, $lte: todayEnd } }).lean(),
        Appointment.find({ date: { $gte: todayStart, $lte: todayEnd } }).lean(),
        Appointment.find({ 
          date: { $gte: todayStart, $lte: todayEnd },
          status: 'completed'
        }).lean(),
        Appointment.find({
          date: { $gte: yesterdayStart, $lte: yesterdayEnd },
          status: 'completed'
        }).lean()
      ]),

      // Billing data
      Billing.aggregate([
        { 
          $match: { 
            date: { $gte: todayStart, $lte: todayEnd },
            status: 'paid'
          } 
        },
        { 
          $group: { 
            _id: null, 
            todayRevenue: { $sum: '$amount' },
            yesterdayRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$date', { $dateFromString: { dateString: yesterdayStart.toISOString() } }] },
                  '$amount',
                  0
                ]
              }
            }
          }
        }
      ]),

      // Critical cases (now using Patient model instead of Appointment reason)
      // Patient.countDocuments({ status: 'critical' })
    ]);

    console.log("patientsData:", appointmentsData)

    // Destructure the fetched data
    const [
      totalPatients,
      activePatients,
      criticalPatients,
      newPatientsToday,
      newPatientsThisMonth,
  newPatientsLastMonth
    ] = patientsData;

    const [
      totalDoctors,
      departments,
      newDoctorsThisMonth
    ] = doctorsData;

    const [
      weeklyAppointments,
      todaysAppointments,
      completedToday,
      completedYesterday
    ] = appointmentsData;

    // Calculate weekly flow
    const weeklyFlow = Array.from({ length: 7 }).map((_, i) => {
      const targetDate = new Date(weekStart);
      targetDate.setDate(targetDate.getDate() + i);
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dayAppointments = weeklyAppointments.filter(a => 
        new Date(a.date) >= startOfDay && 
        new Date(a.date) <= endOfDay
      );

      return {
        day: targetDate.toLocaleDateString('en-US', { weekday: 'short' }),
        appointments: dayAppointments.length,
        patients: [...new Set(dayAppointments.map(a => a.patient.toString()))].length,
      };
    });

    // Find peak day
    const peakDay = weeklyFlow.reduce((max, day) => 
      day.appointments > max.appointments ? day : max, weeklyFlow[0]).day;

    // Calculate department stats
    const departmentStats = departments.map(dept => ({
      name: dept._id,
      doctors: dept.count,
      percentage: Math.round((dept.count / totalDoctors) * 100),
      color: {
        emergency: 'bg-red-500',
        cardiology: 'bg-blue-500',
        neurology: 'bg-orange-500',
        pediatrics: 'bg-purple-500'
      }[dept._id.toLowerCase()] || 'bg-gray-500',
    }));

    // Calculate appointment metrics
    const totalAppointments = weeklyAppointments.length;
    const previousWeekAppointments = await Appointment.countDocuments({
      date: { 
        $gte: new Date(new Date(weekStart).setDate(weekStart.getDate() - 7)),
        $lt: weekStart
      }
    });
    const weeklyChange = previousWeekAppointments > 0 ? 
      Math.round(((totalAppointments - previousWeekAppointments) / previousWeekAppointments) * 100) : 0;

    // Calculate real-time metrics
    const avgWaitTime = completedToday.length > 0 ?
      Math.round(completedToday.reduce((sum, app) => {
        const waitTime = (new Date(app.endTime) - new Date(app.startTime));
        return sum + (waitTime / (1000 * 60)); // Convert ms to minutes
      }, 0) / completedToday.length) : 0;

    const yesterdayAvgWaitTime = completedYesterday.length > 0 ?
      Math.round(completedYesterday.reduce((sum, app) => {
        const waitTime = (new Date(app.endTime) - new Date(app.startTime));
        return sum + (waitTime / (1000 * 60));
      }, 0) / completedYesterday.length) : 0;

    const waitTimeChange = yesterdayAvgWaitTime > 0 ?
      Math.round(((avgWaitTime - yesterdayAvgWaitTime) / yesterdayAvgWaitTime) * 100) : 0;

    const queueLength = todaysAppointments.filter(a => 
      ['scheduled', 'confirmed'].includes(a.status)
    ).length;

    const yesterdayQueueLength = await Appointment.countDocuments({
      date: { $gte: yesterdayStart, $lte: yesterdayEnd },
      status: { $in: ['scheduled', 'confirmed'] }
    });

    const queueChange = yesterdayQueueLength > 0 ?
      Math.round(((queueLength - yesterdayQueueLength) / yesterdayQueueLength) * 100) : 0;

    // Revenue calculations
    const todayRevenue = billingData.length > 0 ? billingData[0].todayRevenue : 0;
    const yesterdayRevenue = billingData.length > 0 ? billingData[0].yesterdayRevenue : 0;
    const revenueChange = yesterdayRevenue > 0 ?
      Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0;
    // Aggregate revenue for both months
const [thisMonthRevenueAgg, lastMonthRevenueAgg] = await Promise.all([
  Billing.aggregate([
    { $match: { date: { $gte: startOfThisMonth, $lte: endOfThisMonth } } },
    { $group: { _id: null, total: { $sum: "$total" } } }
  ]),
  Billing.aggregate([
    { $match: { date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
    { $group: { _id: null, total: { $sum: "$total" } } }
  ])
]);

const thisMonthRevenue = thisMonthRevenueAgg[0]?.total || 0;
const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0;

// Calculate percentage change and trend direction
let monthlyRevenueChange = 0;
let trend = 'flat';

if (lastMonthRevenue > 0) {
  monthlyRevenueChange = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  trend = monthlyRevenueChange > 0 ? 'up' : monthlyRevenueChange < 0 ? 'down' : 'flat';
}


    res.json({
      weeklyFlow,
      peakDay,
      weeklyChange,
      departmentStats,
      realTime: {
        avgWaitTime,
        waitTimeChange,
        queueLength,
        queueChange,
        criticalCases: criticalPatients,
        revenueToday: todayRevenue,
        revenueChange,
        totalActivePatients: activePatients,
        totalPatients,
        totalDoctors,
        newPatientsToday,
        newDoctorsThisMonth,
         monthlyTrend: {
      current: newPatientsThisMonth,
      previous: newPatientsLastMonth,
      change: newPatientsLastMonth > 0 ?
        Math.round(((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100) : 0
    }
      },
    monthlyRevenue: {
    value: thisMonthRevenue,
    trend,
    change: parseFloat(revenueChange.toFixed(2)),
  },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};