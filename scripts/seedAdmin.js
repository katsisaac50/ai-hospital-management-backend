require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user.model"); // ✅ Make sure the path and casing is correct

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const email = "admin@hospital.com";
    const existing = await User.findOne({ email });

    if (existing) {
      console.log("Admin already exists.");
      return process.exit();
    }

    const admin = await User.create({
      name: "Super Admin3",
      email,
      password: "admin123", // ✅ plain password
      role: "admin",
      department: "administration",
    });

    console.log("✅ Admin created successfully:");
    console.log("Admin created: secret123 admin@hospital.com", admin)
    console.log(`Email: ${admin.email}`);
    console.log("Password: admin123");

    process.exit();
  } catch (err) {
    console.error("Seeder error:", err);
    process.exit(1);
  }
};

seedAdmin();
