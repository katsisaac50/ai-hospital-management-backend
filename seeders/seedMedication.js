require('dotenv').config()
const mongoose = require('mongoose')
const Medication = require('../models/medication.model')

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected")
    return seedMedications()
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message)
    process.exit(1)
  })

const seedMedications = async () => {
  try {
    await Medication.deleteMany()

    await Medication.create([
      {
        name: "Amoxicillin",
        strength: "500mg",
        form: "Capsule",
        manufacturer: "PharmaCorp",
        batchNumber: "AMX2024001",
        expiryDate: "2025-08-15",
        quantity: 45,
        minStock: 50,
        maxStock: 200,
        price: 2.5,
        location: "A-12-3",
        category: "antibiotic", // ✅ must match enum exactly
        status: "Low Stock"
      },
      {
        name: "Metformin",
        strength: "850mg",
        form: "Tablet",
        manufacturer: "MediLab",
        batchNumber: "MET2024002",
        expiryDate: "2025-12-20",
        quantity: 180,
        minStock: 100,
        maxStock: 300,
        price: 1.25,
        location: "B-08-1",
        category: "antidiabetic", // ✅ match enum if included
        status: "In Stock"
      }
    ])

    console.log("✅ Medications seeded")
  } catch (err) {
    console.error("❌ Seeding failed:", err.message)
  } finally {
    mongoose.disconnect()
  }
}
