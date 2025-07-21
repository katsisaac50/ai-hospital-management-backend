const mongoose = require("mongoose");
const dotenv = require("dotenv");
const OperatingRoom = require("../models/operatingRoom.model");

dotenv.config(); // loads .env

const seedORs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔗 Connected to MongoDB");

    // Optional: clear existing ORs
    await OperatingRoom.deleteMany();

    const rooms = [
      { roomNumber: "OR-101", type: "general" },
      { roomNumber: "OR-102", type: "cardiac" },
      { roomNumber: "OR-103", type: "orthopedic" },
      { roomNumber: "OR-104", type: "general" },
      { roomNumber: "OR-105", type: "neuro" },
      { roomNumber: "OR-106", type: "general" },
      { roomNumber: "OR-107", type: "other" },
      { roomNumber: "OR-108", type: "cardiac" },
    ];

    await OperatingRoom.insertMany(rooms);
    console.log("✅ ORs seeded");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding ORs:", err);
    process.exit(1);
  }
};

seedORs();
