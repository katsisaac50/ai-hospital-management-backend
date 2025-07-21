const express = require('express');
const connectDB = require('./config/db');
const config = require('./config/env');
const morgan = require('morgan');
const colors = require('colors');
const helmet = require('helmet');
// const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const errorHandler = require('./middlewares/error.middleware');
const { startORAutoReleaseCron, cleaningToAvailableCron } = require("./cron/cronOR");

// Route files

const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const doctorRoutes = require('./routes/doctor.routes');
const pharmacyRoutes = require('./routes/pharmacy.routes');
const labRoutes = require('./routes/lab.routes');
const financialRoutes = require('./routes/financial.routes');
const dashboardRoutes = require('./routes/dashboard.routes')
const stockOrderRoutes = require('./routes/stockOrder.routes')
const interactionRoutes = require('./routes/interactions.routes');
const dispenseRoutes = require('./routes/dispense.routes');

// Connect to database
connectDB();

// Initialize express
const app = express();

// Enable CORS
app.use(cors({ origin: 'http://localhost:3000',
  credentials: true }));

// Body parser
app.use(express.json());

// Dev logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Sanitize data
app.use((req, res, next) => {
  // Only sanitize req.body and req.params manually
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params);
  }
  // Do not touch req.query!
  next();
});

// Set security headers
app.use(helmet());

// Prevent XSS attacks
// app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Mount routers
app.use('/api/v1/stock-orders', stockOrderRoutes)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/pharmacy', pharmacyRoutes);
app.use('/api/v1/lab', labRoutes);
app.use('/api/v1/financial', financialRoutes);
app.use('/api/v1/interactions', interactionRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/v1/dispenselog', dispenseRoutes);

// Swagger
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = {
  swaggerDefinition: { openapi: '3.0.0', info: { title: 'Hospital API', version: '1.0.0' } },
  apis: ['./swagger/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handler middleware
app.use(errorHandler);

startORAutoReleaseCron();
cleaningToAvailableCron();

const PORT = config.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(
    `Server running in ${config.NODE_ENV} mode on port ${PORT}`.yellow.bold
  )
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});
