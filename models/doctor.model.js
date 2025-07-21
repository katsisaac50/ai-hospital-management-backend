const mongoose = require('mongoose');

const scheduleSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        // Check time format HH:mm (24h)
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} is not a valid start time (HH:mm)!`,
    },
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} is not a valid end time (HH:mm)!`,
    },
  },
  isAvailable: { type: Boolean, default: true },
  capacity: { type: Number, default: 5, min: 1 }, // max patients per slot
});

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

scheduleSlotSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime) {
    const start = timeToMinutes(this.startTime);
    const end = timeToMinutes(this.endTime);
    if (start >= end) {
      this.invalidate('startTime', 'startTime must be earlier than endTime');
    }
  }
  next();
});


const doctorSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, 'Please add first name'] },
  lastName: { type: String, required: [true, 'Please add last name'] },
  specializations: {
    type: [String],
    required: true,
    validate: {
      validator: arr => arr.length > 0,
      message: 'At least one specialization is required',
    },
  },
  department: {
    type: String,
    enum: ['emergency', 'cardiology', 'neurology', 'pediatrics'],
    required: true,
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: v => /^DOC-\d{5}$/.test(v),
      message: props => `${props.value} is not a valid license number! It should be "DOC-" followed by 5 digits.`,
    },
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: props => `${props.value} is not a valid 10-digit phone number!`,
    },
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    validate: {
      validator: v => v.endsWith('@hospital.com'),
      message: 'Email must be a hospital.com domain',
    },
  },
  rating: {
  type: Number,
  min: 0,
  max: 5,
  default: 0,
},
experience: {
  type: String,
  validate: {
    validator: v => /^\d+\s+years?$/.test(v),
    message: 'Experience must be like "8 years"',
  },
},
patientsCount: { type: Number, default: 0 },
availability: {
  type: String,
  enum: ['Available', 'Busy', 'On Leave'],
  default: 'Available',
},
nextSlot: {
  type: String,
  validate: {
    validator: v => /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i.test(v),
    message: 'nextSlot must be in format like "1:45 PM"',
  },
},
  schedule: [scheduleSlotSchema],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

doctorSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

doctorSchema.pre('save', function (next) {
  const seen = new Set();
  for (let slot of this.schedule) {
    const key = `${slot.day}-${slot.startTime}-${slot.endTime}`;
    if (seen.has(key)) {
      return next(new Error(`Duplicate schedule slot found: ${key}`));
    }
    seen.add(key);
  }
  next();
});


doctorSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});
doctorSchema.set('toObject', { virtuals: true });


module.exports = mongoose.model('Doctor', doctorSchema);


// const mongoose = require('mongoose');

// const doctorSchema = new mongoose.Schema({
//   firstName: {
//     type: String,
//     required: [true, 'Please add first name'],
//   },
//   lastName: {
//     type: String,
//     required: [true, 'Please add last name'],
//   },
//   specialization: {
//     type: String,
//     required: [true, 'Please add specialization'],
//   },
//   department: {
//     type: String,
//     enum: ['emergency', 'cardiology', 'neurology', 'pediatrics'],
//     required: true,
//   },
//   licenseNumber: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   phone: {
//     type: String,
//     required: [true, 'Please add phone number'],
//   },
//   email: {
//     type: String,
//     match: [
//       /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
//       'Please add a valid email',
//     ],
//   },
//   schedule: [
//     {
//       day: {
//         type: String,
//         enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
//       },
//       startTime: String,
//       endTime: String,
//       isAvailable: Boolean,
//     },
//   ],
//   isActive: {
//     type: Boolean,
//     default: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model('Doctor', doctorSchema);