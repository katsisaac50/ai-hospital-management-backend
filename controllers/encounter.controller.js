const Encounter = require("../models/encounter.model.js");
const Patient = require("../models/patient.model.js");
const Prescription = require("../models/prescription.model.js");
// const { Parser } = require("json2csv");

/**
 * Create a new clinical encounter for a patient
 */
exports.createEncounter = async (req, res) => {
  const session = await Encounter.startSession();
  session.startTransaction();

  try {
    const { patientId } = req.params;
    const userRole = req.user?.role; // doctor | nurse | admin

    // ✅ 1. Ensure patient exists
    const patient = await Patient.findById(patientId).session(session);
    if (!patient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Patient not found" });
    }

    // ✅ 2. Base fields
    const baseFields = {
      patient: patientId,
      chiefComplaints: req.body.chiefComplaints || [],
      vitals: req.body.vitals || {},
      createdBy: req.user._id,
      doctor: userRole === "doctor" ? req.user._id : undefined,
    };

    if (userRole === "doctor" || userRole === "admin") {
      baseFields.differentialDiagnosis = req.body.differentialDiagnosis || [];
      baseFields.diagnosis = req.body.diagnosis || [];
      baseFields.treatment = req.body.treatment || [];
      baseFields.followUp = req.body.followUp || {};
    }

    // ✅ 3. Create encounter inside the transaction
    const encounter = await Encounter.create(
      [
        {
          ...baseFields,
          auditTrail: [
            {
              action: "create",
              user: req.user._id,
              role: req.user.role,
              changes: baseFields,
            },
          ],
        },
      ],
      { session }
    );

    // create() with array returns array
    const newEncounter = encounter[0];

    // ✅ 4. Optionally create prescription and link
    let prescription = null;
    if (req.body.prescription) {
      prescription = await Prescription.create(
        [
          {
            patient: patientId,
            encounter: newEncounter._id,
            doctor: req.body.doctor || req.user._id,
            medications: req.body.prescription.medications.map(m => ({
              medication: m.medication, // ✅ must be an ObjectId
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration,
              quantity: Number(m.quantity) || 0,
            })),
            notes: req.body.prescription.notes,
            insurance: req.body.prescription.insurance,
          },
        ],
        { session }
      );

      // link prescription to encounter
      newEncounter.prescription = prescription[0]._id;
      await newEncounter.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Encounter created successfully",
      data: newEncounter,
      prescription: prescription ? prescription[0] : null,
    });
  } catch (err) {
    console.error("Create encounter error:", err);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "Failed to create encounter with prescription",
      error: err.message,
    });
  }
};



/**
 * Get all encounters for a patient (excluding soft-deleted by default)
 * GET /api/v1/encounters/patient/64fa9d...?start=2025-09-01&end=2025-09-30&page=2&limit=10
 * GET /api/v1/encounters/patient/64fa9d...?includeDeleted=true
 */
exports.getEncounters = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { start, end, page = 1, limit = 10, includeDeleted } = req.query;

    // ✅ Ensure patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // ✅ Build a single query object with all filters
    const query = { patient: patientId };

    // Date filtering
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = new Date(start);
      if (end) query.createdAt.$lte = new Date(end);
    }

    // Soft delete filter
    if (includeDeleted !== "true") {
      query.deleted = { $ne: true };
    }

    // ✅ Pagination setup
    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // ✅ Fetch encounters
    const [encounters, total] = await Promise.all([
      Encounter.find(query)
        .populate({
          path: "patient",
          select: "name gender dateOfBirth medicalRecordNumber",
        })
        .populate({
          path: "doctor",
          select: "name specialty",
        })
        .populate({
          path: 'prescription',
          populate: { path: 'medications.medication', select: 'name strength' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Encounter.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: encounters.length,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        hasNextPage: pageNumber * limitNumber < total,
        hasPrevPage: pageNumber > 1,
      },
      patient: {
        id: patient.id,
        name: patient.name,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
        medicalRecordNumber: patient.medicalRecordNumber,
      },
      data: encounters,
    });
  } catch (err) {
    console.error("Get encounters error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch encounters",
      error: err.message,
    });
  }
};

/**
 * Get a single encounter by ID
 */
exports.getEncounter = async (req, res) => {
  try {
    const { patientId, encounterId } = req.params;

    const encounter = await Encounter.findOne({
      _id: encounterId,
      patient: patientId,
    });

    if (!encounter) {
      return res
        .status(404)
        .json({ success: false, message: "Encounter not found" });
    }

    res.json({ success: true, data: encounter });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update an encounter (including differential diagnosis, diagnosis, treatment, followUp)
 */
exports.updateEncounter = async (req, res) => {
  try {
    const { patientId, encounterId } = req.params;
    const userRole = req.user?.role;

    // Only allow nurses to edit vitals & chief complaints
    const updateFields = {
      chiefComplaints: req.body.chiefComplaints,
      vitals: req.body.vitals,
      updatedAt: new Date(),
    };

    if (userRole === "doctor" || userRole === "admin") {
      Object.assign(updateFields, {
        differentialDiagnosis: req.body.differentialDiagnosis,
        diagnosis: req.body.diagnosis,
        treatment: req.body.treatment,
        followUp: req.body.followUp,
        prescription: req.body.prescription,
      });
    }

    const encounter = await Encounter.findOneAndUpdate(
      { _id: encounterId, patient: patientId },
      {
        $set: updateFields,
        $push: {
          auditTrail: {
            action: "update",
            user: user._id,
            role: user.role,
            changes: updateFields,
          },
        },
      },
      { new: true }
    );

    if (!encounter) {
      return res.status(404).json({ success: false, message: "Encounter not found" });
    }

    res.json({ success: true, data: encounter });
  } catch (err) {
    console.error("Update encounter error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Soft delete an encounter (mark as deleted)
 */
exports.deleteEncounter = async (req, res) => {
  try {
    const { patientId, encounterId } = req.params;

    const encounter = await Encounter.findOneAndUpdate(
      { _id: encounterId, patient: patientId },
      {
        deleted: true,
        deletedAt: new Date(),
        $push: {
          auditTrail: {
            action: "delete",
            user: user._id,
            role: user.role,
            changes: { deleted: true },
          },
        },
      },
      { new: true }
    );

    if (!encounter) {
      return res
        .status(404)
        .json({ success: false, message: "Encounter not found" });
    }

    res.json({ success: true, data: encounter });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Restore a soft-deleted encounter
 */
exports.restoreEncounter = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized to restore" });
    }

    const { patientId, encounterId } = req.params;

    const encounter = await Encounter.findOneAndUpdate(
      { _id: encounterId, patient: patientId },
      {
        deleted: false,
        deletedAt: null,
        $push: {
          auditTrail: {
            action: "restore",
            user: user._id,
            role: user.role,
            changes: { deleted: false },
          },
        },
      },
      { new: true }
    );

    if (!encounter) {
      return res.status(404).json({ success: false, message: "Encounter not found" });
    }

    res.json({ success: true, data: encounter });
  } catch (err) {
    console.error("Restore encounter error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Export encounters for a patient as CSV
 * GET /api/v1/encounters/export/:patientId
 */
// exports.exportEncountersToCSV = async (req, res) => {
//   try {
//     const { patientId } = req.params;
//     const { start, end, includeDeleted } = req.query;

//     // ✅ Ensure patient exists
//     const patient = await Patient.findById(patientId);
//     if (!patient) {
//       return res.status(404).json({ message: "Patient not found" });
//     }

//     // ✅ Build query with optional date & deleted filtering
//     const query = { patient: patientId };

//     if (start || end) {
//       query.createdAt = {};
//       if (start) query.createdAt.$gte = new Date(start);
//       if (end) query.createdAt.$lte = new Date(end);
//     }

//     if (includeDeleted !== "true") {
//       query.deleted = { $ne: true };
//     }

//     // ✅ Fetch encounters with patient & doctor populated
//     const encounters = await Encounter.find(query)
//       .populate({
//         path: "doctor",
//         select: "name specialty",
//       })
//       .populate({
//         path: "patient",
//         select: "name gender dateOfBirth medicalRecordNumber",
//       })
//       .sort({ createdAt: -1 });

//     if (!encounters.length) {
//       return res.status(404).json({ message: "No encounters found to export" });
//     }

//     // ✅ Define CSV fields
//     const fields = [
//       { label: "Encounter ID", value: "encounterId" },
//       { label: "Patient Name", value: "patient.name" },
//       { label: "Gender", value: "patient.gender" },
//       { label: "Date of Birth", value: (row) => row.patient.dateOfBirth?.toISOString().split("T")[0] },
//       { label: "Medical Record Number", value: "patient.medicalRecordNumber" },
//       { label: "Visit Date", value: (row) => row.visitDate?.toISOString().split("T")[0] },
//       { label: "Reason for Visit", value: "reasonForVisit" },
//       { label: "Chief Complaints", value: (row) => row.chiefComplaints?.join("; ") },
//       { label: "Diagnosis", value: (row) => row.diagnosis?.map(d => d.condition).join("; ") },
//       { label: "Doctor Name", value: "doctor.name" },
//       { label: "Doctor Specialty", value: "doctor.specialty" },
//       { label: "Created At", value: (row) => row.createdAt?.toISOString() },
//     ];

//     const parser = new Parser({ fields });
//     const csv = parser.parse(encounters);

//     // ✅ Send CSV as downloadable file
//     const filename = `encounters_${patient.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
//     res.header("Content-Type", "text/csv");
//     res.attachment(filename);
//     res.send(csv);
//   } catch (err) {
//     console.error("Export encounters error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to export encounters",
//       error: err.message,
//     });
//   }
// };

