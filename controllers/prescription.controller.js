const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const Prescription = require('../models/prescription.model');
const StockLog = require('../models/stockLog.model'); // hypothetical
const DispenseLog = require('../models/dispenseLog.model'); // hypothetical
const StockOrder = require('../models/stockOrder.model'); // hypothetical
const Medication = require('../models/medication.model');
const Invoice = require('../models/billing.model');
const estimateQuantity = require('../utils/calculateQuantity')
const moment = require('moment');

// @desc    Get recent pharmacy activities
// @route   GET /api/v1/pharmacy/activities
// @access  Private
exports.getPharmacyActivities = asyncHandler(async (req, res, next) => {
  try {
    const [prescriptions, stockAlerts, dispenses, stockOrders] = await Promise.all([
      Prescription.find().sort({ createdAt: -1 }).limit(5).populate('patient').populate('doctor'),
      StockLog.find({ type: 'low-stock' }).sort({ createdAt: -1 }).limit(5),
      DispenseLog.find().sort({ createdAt: -1 }).limit(5).populate('patient').populate('dispensedBy').populate('medications.medication'),
      StockOrder.find().sort({ createdAt: -1 }).limit(5)
    ]);

    const activities = [];

    console.log("Fetched activities:", {
      prescriptions: prescriptions},
      {stockAlerts: stockAlerts.length},{dispenses: dispenses.length},)

    // 1. Prescriptions
    prescriptions?.forEach(p => {
    const doctorName = p.doctor ? `${p.doctor.fullName}` : 'Unknown';
const patientName = p.patient?.name || 'a patient';
      activities.push({
        id: p._id,
        type: 'prescription',
        description: `New prescription from Dr. ${doctorName} for ${patientName}`,
        time: moment(p.createdAt).fromNow(),
        status: 'pending',
      });
    });
console.log("Prescription activities:", activities);
    // 2. Stock Alerts
    stockAlerts.forEach(alert => {
    {console.log("stock activity:", alert)}
      activities.push({
        id: alert._id,
        type: 'stock',
        description: `Low stock alert: ${alert.medicationName} (${alert.unit})`,
        time: moment(alert.createdAt).fromNow(),
        status: 'warning',
      });
    });

    // 3. Dispensed Medications
    dispenses.forEach(d => {
      activities.push({
        id: d._id,
        type: 'dispensed',
        description: `Medication dispensed to ${d.patient?.fullName || 'patient'}`,
        time: moment(d.createdAt).fromNow(),
        status: 'completed',
      });
    });

    // 4. Stock Orders
    stockOrders.forEach(order => {
      {console.log("order activity:", order)}
      activities.push({
        id: order._id,
        type: 'order',
        description: `New stock order placed for ${order.medicationName}`,
        time: moment(order.createdAt).fromNow(),
        status: order.status || 'processing',
      });
    });

    // 5. Sort all by time descending
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json(activities.slice(0, 10)); // return top 10
  } catch (error) {
    console.error("Failed to load pharmacy activities:", error.message);
  res.status(500).json({ message: "Failed to load pharmacy activities", error: error.message });
  }
});

// @desc    Get prescriptions for billing by patient ID
// @route   PUT /api/v1/pharmacy/prescriptions/patient/:patientId
// @access  Private
exports.billingPrescription = asyncHandler(async (req, res) => {
  console.log('ere biling prescription', req.body)
  try {
    const { patientId } = req.params;
    
    const prescriptions = await Prescription.find({ patientId })
      .populate('medications.medication', 'name strength form')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: prescriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching prescriptions'
    });
  }
});

// @desc    Create a prescription
// @route   POST /api/v1/pharmacy/prescriptions
// @access  Private
exports.createPrescription = asyncHandler(async (req, res) => {
  const { patient, doctor, medications, notes, status, priority, insurance, copay } = req.body;


  if (!Array.isArray(medications) || medications.length === 0) {
    return res.status(400).json({ message: 'At least one medication is required' });
  }
  
//   function parsePrescriptionDetails(med) {
//   const frequencyMatch = med.frequency?.match(/x(\d+)/i)
//   const frequency = frequencyMatch ? parseInt(frequencyMatch[1], 10) : 1

//   const durationMatch = med.duration?.match(/(\d+)/)
//   const duration = durationMatch ? parseInt(durationMatch[1], 10) : 1

//   return { frequency, duration }
// }

  const medicationEntries = [];

  let totalCost = 0

  for (const med of medications) {
    if (!med.medication) {
      return res.status(400).json({ message: 'Each medication must include a valid medication ID' });
    }

    const medDoc = await Medication.findById(med.medication);
    if (!medDoc) {
      return res.status(400).json({ message: `Medication with ID "${med.medication}" not found in Pharmacy` });
    }

    // const { frequency, duration } = parsePrescriptionDetails(med)
    const quantity = estimateQuantity(med)
    const cost = quantity * medDoc.price
    totalCost += cost

    medicationEntries.push({
      medication: med.medication,
      dosage: med.dosage?.trim() || '',
      frequency: med.frequency?.trim() || '',
      duration: med.duration?.trim() || '',
      quantity,
      cost,
    });
  }

  const prescription = await Prescription.create({
    patient,
    doctor,
    medications: medicationEntries,
    totalCost,
    // copay: totalCost * 0.1, // optional
    notes,
    status,
    priority,
    insurance,
    copay,
  });

  res.status(201).json({ success: true, data: prescription });
});



exports.getPrescriptions = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
  // try {
  //   const prescriptions = await Prescription.find()
  //     .populate('patient')
  //     .populate('doctor')
  //     .populate('medications.medication');

  //   res.status(200).json(prescriptions);
  // } catch (error) {
  //   console.error('Error fetching prescriptions:', error);
  //   res.status(500).json({ message: 'Failed to fetch prescriptions', error: error.message });
  // }
});

exports.processPrescription = asyncHandler(async(req, res, next) => {
   const { id } = req.params
  console.log('process id', id);
// console.log('ppro', req)
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {

    // Find the prescription by id
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Only process if status is 'Pending'
    if (prescription.status !== 'Pending') {
      return res.status(400).json({ message: 'Prescription is not pending' });
    }

    // Update status to 'Processed' (or whatever you want)
    prescription.status = 'Ready';
    await prescription.save();

    res.status(200).json({ message: 'Prescription processed successfully', prescription });
  } catch (error) {
    console.error('Error processing prescription:', error);
    res.status(500).json({ message: 'Server error' });
  }
})

exports.dispensePrescription = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Find the prescription by id
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    console.log('prescription controller', prescription)

    // Only process if status is 'Ready'
    if (prescription.status !== 'Ready') {
      return res.status(400).json({ message: 'Prescription is not ready for dispensing' });
    }

    // Check if there's an invoice and if it's paid
    const invoice = await Invoice.findOne({ prescriptionId: id });
    if (!invoice) {
      return res.status(400).json({ message: 'No invoice found for this prescription' });
    }
    
    if (invoice.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Invoice not paid. Cannot dispense medication.' });
    }

    // Update status to 'Dispensed'
    prescription.status = status;
    await prescription.save();

    // Record dispensing activity
    await DispenseLog.create({
      prescription: id,
      patient: prescription.patient,
      dispensedBy: req.user.id, // assuming user info is in request
      dispensedAt: new Date()
    });

    res.status(200).json({ message: 'Prescription dispensed successfully', prescription });
  } catch (error) {
    console.error('Error dispensing prescription:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

exports.deletePrescription = asyncHandler(async(req, res, next) =>{
  
  try {
    const { id } = req.query
    await Prescription.findByIdAndDelete(id)
    return res.status(200).json({ message: 'Deleted successfully' })
  } catch (err) {
    return res.status(400).json({ error: 'Delete failed' })
  }

})

exports.getPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'name fullName')
    .populate('doctor', 'firstName lastName fullName email')
    .populate({
      path: 'medications.medication',
      match: { isActive: true },
      select: 'name strength price'
    });

  if (!prescription) {
    return next(
      new ErrorResponse(`Medication not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: prescription,
  });
});

exports.updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params
  console.log('update prescription', req.body, id)
  const {
    medications,
    status,
    priority,
    notes,
    insurance
  } = req.body

  let totalCost = 0

  // Calculate cost for each medication
  const updatedMeds = await Promise.all(medications.map(async (entry) => {
    const medDoc = await Medication.findById(entry.medication)
    if (!medDoc) throw new Error(`Medication not found: ${entry.medication}`)

    const unitCost = medDoc.price || 0
    const quantity = entry.quantity || 0
    const cost = unitCost * quantity
    totalCost += cost

    return {
      ...entry,
      cost,
      quantity,
    }
  }))

  const updated = await Prescription.findByIdAndUpdate(
    id,
    {
      medications: updatedMeds,
      status,
      priority,
      notes,
      totalCost,
      insurance,
    },
    { new: true, runValidators: true }
  )

  if (!updated) return res.status(404).json({ message: "Prescription not found" })

  res.status(200).json({ success: true, data: updated })
})


// export async function getDashboardStats() {
//   const totalPrescriptions = await Prescription.countDocuments()
//   const recentPrescriptions = await Prescription.find().sort({ createdAt: -1 }).limit(5)
//   const topMedications = await Prescription.aggregate([
//     {
//       $group: {
//         _id: '$medications',
//         count: { $sum: 1 },
//       },
//     },
//     { $sort: { count: -1 } },
//     { $limit: 5 },
//   ])
//   return {
//     totalPrescriptions,
//     recentPrescriptions,
//     topMedications,
//   }
// }

// if (req.method === 'DELETE') {
//   try {
//     const { id } = req.query
//     await Prescription.findByIdAndDelete(id)
//     return res.status(200).json({ message: 'Deleted successfully' })
//   } catch (err) {
//     return res.status(400).json({ error: 'Delete failed' })
//   }
// }

// if (req.method === 'PUT') {
//   try {
//     const { id } = req.query
//     const updated = await Prescription.findByIdAndUpdate(id, req.body, { new: true })
//     return res.status(200).json(updated)
//   } catch (err) {
//     return res.status(400).json({ error: 'Update failed' })
//   }
// }

// import dbConnect from '@/lib/dbConnect'
// import Prescription from '@/models/Prescription'

// export default async function handler(req, res) {
//   await dbConnect()

//   if (req.method === 'POST') {
//     try {
//       const prescription = await Prescription.create(req.body)
//       return res.status(201).json(prescription)
//     } catch (err) {
//       return res.status(400).json({ error: err.message })
//     }
//   }

//   if (req.method === 'GET') {
//     try {
//       const prescriptions = await Prescription.find().sort({ createdAt: -1 })
//       return res.status(200).json(prescriptions)
//     } catch (err) {
//       return res.status(500).json({ error: 'Server error' })
//     }
//   }

//   return res.status(405).json({ message: 'Method Not Allowed' })
// }


// This is a placeholder utility to simulate offline storage and sync handling
// To be used with service workers / IndexedDB or localStorage

// export function queueOfflineAction(type, payload) {
//   const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]')
//   queue.push({ type, payload, timestamp: Date.now() })
//   localStorage.setItem('offlineQueue', JSON.stringify(queue))
// }

// export async function syncOfflineQueue() {
//   const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]')
//   const results = []

//   for (const item of queue) {
//     try {
//       const res = await fetch(`/api/${item.type}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(item.payload),
//       })
//       if (!res.ok) throw new Error('Failed')
//       results.push({ status: 'success', item })
//     } catch (err) {
//       results.push({ status: 'failed', item })
//     }
//   }

//   localStorage.setItem('offlineQueue', '[]')
//   return results
// }

// exports.createPrescription = asyncHandler(async (req, res, next) => {
//   console.log('Incoming prescription payload:', req.body);

//   try {
//     const { patient, doctor, medications, notes } = req.body;

//     if (!Array.isArray(medications) || medications.length === 0) {
//       return res.status(400).json({ message: 'At least one medication is required' });
//     }

//     const medicationEntries = [];

//     for (const medString of medications) {
//   // Assumes: "Paracetamol 500mg x2/day"
//   const parts = medString.trim().split(' '); // e.g., ["Paracetamol", "500mg", "x2/day"]
//   const freqPart = parts.pop();               // "x2/day"
//   const dosage = parts.pop();                 // "500mg"
//   const name = parts.join(' ');               // "Paracetamol" or "Vitamin C"

//   const frequency = freqPart?.startsWith('x') ? freqPart : `x${freqPart}`;

//   const selectedMed = await Medication.findOne({
//     name: new RegExp(`^${name.trim()}$`, 'i') // case-insensitive match
//   });

//   if (!selectedMed) {
//     return res.status(400).json({ message: `Medication "${name}" not found in Pharmacy` });
//   }

//   medicationEntries.push({
//     medication: selectedMed._id,
//     dosage: dosage?.trim(),
//     frequency,
//     duration: '5 days'
//   });
// }

//     const newPrescription = await Prescription.create({
//       patient,
//       doctor,
//       medications: medicationEntries,
//       notes,
//     });

//     res.status(201).json(newPrescription);
//   } catch (error) {
//     console.error('Failed to create prescription:', error);
//     res.status(500).json({ message: 'Failed to create prescription', error: error.message });
//   }
// });
