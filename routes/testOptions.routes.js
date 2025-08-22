const express = require("express");
const { getTestOptions } = require("../controllers/testOption.controller");
const router = express.Router();

router.get("/", getTestOptions);

module.exports = router;




// const TestOption = require("../models/TestOption.model");

// router.get("/", async (req, res) => {
//   console.log("Received request for test options", req.query);
//   const category = req.query.category?.toLowerCase();

//   if (!category) {
//     return res.status(400).json({ error: "Category query parameter is required." });
//   }

//   try {
//     const options = await TestOption.findOne({ category });
//     if (!options) {
//       return res.status(404).json({ error: "Category not found in database." });
//     }
//     res.json({
//       testTypes: options.testTypes,
//       sampleTypes: options.sampleTypes,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

module.exports = router;
