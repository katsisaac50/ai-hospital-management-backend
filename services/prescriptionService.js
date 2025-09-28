const Patient = require('../models/patient.model');
const Prescription = require('../models/prescription.model');
const mongoose = require('mongoose');

async function createPrescription({ patientId, doctorId, medications, notes }) {
  // 1. Find the patient
  const patient = await Patient.findById(patientId);
  if (!patient) throw new Error("Patient not found");

  // 2. Get the latest encounter
  let latestEncounter = patient.clinicalEncounters[patient.clinicalEncounters.length - 1];

  // ✅ Auto-create encounter if none exists
  if (!latestEncounter) {
    const newEncounter = {
      _id: new mongoose.Types.ObjectId(),
      date: new Date(),
      doctor: doctorId,
      notes: "Auto-created encounter for prescription",
      prescription: null,
    };
    patient.clinicalEncounters.push(newEncounter);
    latestEncounter = newEncounter;
  }

  // 3. Create prescription linked to that encounter
  const prescription = await Prescription.create({
    patient: patient._id,
    encounter: latestEncounter._id,
    doctor: doctorId,
    medications,
    notes,
  });

  // 4. Save reference back into encounter
  latestEncounter.prescription = prescription._id;
  await patient.save();

  return prescription;
}

module.exports = { createPrescription };
