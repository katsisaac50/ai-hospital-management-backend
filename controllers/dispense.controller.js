const DispenseLog = require('../models/dispenseLog.model');
const Medication = require('../models/medication.model');

exports.createDispenseLog = async (req, res) => {
  try {
    const { patient, prescription, medications, dispensedBy, method, notes } = req.body;

    // Optional: Validate medications
    for (const item of medications) {
      const med = await Medication.findById(item.medication);
      if (!med) return res.status(400).json({ message: `Invalid medication ID: ${item.medication}` });

      // Auto-deduct stock
      if (item.quantity > med.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${med.name}` });
      }

      await Medication.findByIdAndUpdate(item.medication, {
        $inc: { quantity: -item.quantity },
      });
    }

    const log = await DispenseLog.create({
      patient,
      prescription,
      medications,
      dispensedBy,
      method,
      notes,
    });

    res.status(201).json(log);
  } catch (err) {
    console.error('Failed to create dispense log:', err);
    res.status(500).json({ message: 'Dispense log failed', error: err.message });
  }
};

exports.getDispenseLogs = async (req, res) => {
  try {
    const logs = await DispenseLog.find()
      .populate('patient')
      .populate('prescription')
      .populate('dispensedBy')
      .populate('medications.medication');

    res.json(logs);
  } catch (err) {
    console.error('Error loading logs:', err);
    res.status(500).json({ message: 'Error fetching dispense logs' });
  }
};
