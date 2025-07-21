const express = require('express')
const router = express.Router()
const { getDashboardStats } = require('../controllers/dashboard.controller')

router.get('/dashboard-stats', getDashboardStats)

module.exports = router



// const express = require("express")
// const router = express.Router()
// const Appointment = require("../models/Appointment")
// const Patient = require("../models/Patient")

// router.get("/overview", async (req, res) => {
//   try {
//     const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
//     const weeklyFlow = days.map((day, i) => ({
//       day,
//       patients: Math.floor(Math.random() * 80 + 20),
//       appointments: Math.floor(Math.random() * 70 + 15),
//     }))

//     const departments = [
//       { name: "Emergency", percentage: 28, color: "bg-red-500", patients: 156 },
//       { name: "Cardiology", percentage: 22, color: "bg-blue-500", patients: 123 },
//       { name: "Orthopedics", percentage: 18, color: "bg-green-500", patients: 98 },
//       { name: "Pediatrics", percentage: 16, color: "bg-purple-500", patients: 87 },
//       { name: "Neurology", percentage: 16, color: "bg-orange-500", patients: 89 },
//     ]

//     const metrics = {
//       avgWaitTime: 12,
//       waitTimeChange: -3,
//       queueLength: 23,
//       queueChange: 5,
//       criticalCases: 3,
//       revenueToday: 24500,
//       revenueChange: 15,
//       totalActivePatients: 553,
//     }

//     res.json({
//       weeklyFlow,
//       peakDay: "Fri",
//       weeklyChange: 12,
//       departments,
//       metrics,
//     })
//   } catch (err) {
//     res.status(500).json({ error: err.message })
//   }
// })

// module.exports = router
