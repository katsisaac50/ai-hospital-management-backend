const mongoose = require('mongoose');
const Service = require('../models/services.model');
const dotenv = require('dotenv');

dotenv.config();

const services = [
  { 
    name: 'General Consultation', 
    code: 'GCON',
    price: 100,
    category: 'consultation',
    description: 'Basic medical consultation with a doctor'
  },
  { 
    name: 'Blood Test', 
    code: 'BLT',
    price: 50,
    category: 'diagnostic',
    description: 'Complete blood count test'
  },
  { 
    name: 'X-Ray', 
    code: 'XRAY',
    price: 150,
    category: 'diagnostic',
    description: 'Standard X-ray imaging'
  },
  { 
    name: 'MRI Scan', 
    code: 'MRI',
    price: 500,
    category: 'diagnostic',
    description: 'Magnetic Resonance Imaging scan'
  },
  { 
    name: 'Ultrasound', 
    code: 'ULS',
    price: 200,
    category: 'diagnostic',
    description: 'Ultrasound imaging procedure'
  },
  { 
    name: 'Minor Surgery', 
    code: 'MSURG',
    price: 800,
    category: 'procedure',
    description: 'Minor surgical procedure'
  },
  { 
    name: 'Physical Therapy', 
    code: 'PTH',
    price: 120,
    category: 'treatment',
    description: 'Physical therapy session'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Clear existing services
    await Service.deleteMany();
    
    // Insert new services
    const createdServices = await Service.insertMany(services);
    
    console.log(`${createdServices.length} services seeded successfully`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();