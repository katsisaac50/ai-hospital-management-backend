const TestOption = require("../models/testOption.model");

exports.getTestOptions = async (req, res, next) => {
  try {
    const options = await TestOption.find();
    res.status(200).json({
      success: true,
      data: options,
    });
  } catch (err) {
    next(err);
  }
};
