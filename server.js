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
const { startORAutoReleaseCron, cleaningToAvailableCron, paymentReconciliationCron
 } = require("./cron/cronOR");

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
const servicesRoutes = require('./routes/services.routes');
const testOptionsRouter = require("./routes/testOptions.routes");
const payments = require('./routes/payments.routes');


// Connect to database
connectDB();

// Initialize express
const app = express();

// Enable CORS
// app.use(cors({ origin: 'http://localhost:3000',
//   credentials: true }));
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigin = process.env.CLIENT_URL;

    // Allow requests with no origin (e.g., Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (origin === allowedOrigin) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

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

// Application startup routine
app.startup = async () => {
  try {
    // await initializeTransporter();
    console.log('Email transporter initialized'.green);
    
    // Add other startup tasks here
    console.log('Server startup completed'.green.bold);
  } catch (error) {
    console.error('Startup failed:'.red, error);
    process.exit(1);
  }
};

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
app.use('/api/v1/services', servicesRoutes);
app.use("/api/v1/test-options", testOptionsRouter);
app.use('/api/v1/payments', payments);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV
  });
});


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
paymentReconciliationCron();

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





// const express = require('express');
// const connectDB = require('./config/db');
// const config = require('./config/env');
// const morgan = require('morgan');
// const colors = require('colors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const hpp = require('hpp');
// const cors = require('cors');
// const mongoSanitize = require('express-mongo-sanitize');
// const errorHandler = require('./middlewares/error.middleware');
// const { startORAutoReleaseCron, cleaningToAvailableCron } = require("./cron/cronOR");
// // const { initializeTransporter } = require('./services/email');
// const compression = require('compression');
// const cookieParser = require('cookie-parser');
// const responseTime = require('response-time');
// const requestIp = require('request-ip');

// // Route files
// const authRoutes = require('./routes/auth.routes');
// const patientRoutes = require('./routes/patient.routes');
// const appointmentRoutes = require('./routes/appointment.routes');
// const doctorRoutes = require('./routes/doctor.routes');
// const pharmacyRoutes = require('./routes/pharmacy.routes');
// const labRoutes = require('./routes/lab.routes');
// const financialRoutes = require('./routes/financial.routes');
// const dashboardRoutes = require('./routes/dashboard.routes');
// const stockOrderRoutes = require('./routes/stockOrder.routes');
// const interactionRoutes = require('./routes/interactions.routes');
// const dispenseRoutes = require('./routes/dispense.routes');
// const servicesRoutes = require('./routes/services.routes');

// // Connect to database
// connectDB();

// // Initialize express
// const app = express();

// // Trust proxy if behind load balancer/reverse proxy
// app.set('trust proxy', config.TRUST_PROXY || 1);

// // Enable CORS with production-ready settings
// const corsOptions = {
//   origin: config.NODE_ENV === 'development' 
//     ? 'http://localhost:3000' 
//     : [config.FRONTEND_URL, 'https://your-production-domain.com'],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   optionsSuccessStatus: 200
// };
// app.use(cors(corsOptions));

// // Preflight CORS handling
// app.options('*', cors(corsOptions));

// // Body parser with size limit
// app.use(express.json({ limit: '10kb' }));
// app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// // Cookie parser
// app.use(cookieParser());

// // Response time headers
// app.use(responseTime());

// // Client IP middleware
// app.use(requestIp.mw());

// // Dev logging middleware
// if (config.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// } else {
//   // Production logging format
//   morgan.token('client-ip', (req) => req.clientIp);
//   app.use(morgan(':client-ip :method :url :status :response-time ms - :res[content-length]'));
// }

// // Gzip compression
// app.use(compression());

// // Set security headers
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.example.com'],
//       styleSrc: ["'self'", "'unsafe-inline'", 'cdn.example.com'],
//       imgSrc: ["'self'", 'data:', 'cdn.example.com'],
//       connectSrc: ["'self'", 'api.example.com']
//     }
//   },
//   referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
// }));

// // Rate limiting - different limits for different routes
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 200,
//   message: 'Too many requests from this IP, please try again later',
//   skip: (req) => req.ip === '127.0.0.1' // Skip for localhost
// });

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20,
//   message: 'Too many login attempts, please try again later'
// });

// // Apply rate limiting
// app.use('/api/v1/auth', authLimiter);
// app.use('/api', apiLimiter);

// // Prevent http param pollution
// app.use(hpp({
//   whitelist: ['sort', 'select', 'page', 'limit'] // Whitelist some query params
// }));

// // Data sanitization against NoSQL query injection
// app.use(mongoSanitize({
//   replaceWith: '_',
//   onSanitize: ({ req, key }) => {
//     console.warn(`Sanitized ${key} in request ${req.method} ${req.path}`);
//   }
// }));

// // Application startup routine
// app.startup = async () => {
//   try {
//     // await initializeTransporter();
//     console.log('Email transporter initialized'.green);
    
//     // Add other startup tasks here
//     console.log('Server startup completed'.green.bold);
//   } catch (error) {
//     console.error('Startup failed:'.red, error);
//     process.exit(1);
//   }
// };

// // Mount routers with versioning and documentation
// app.use('/api/v1/stock-orders', stockOrderRoutes);
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/patients', patientRoutes);
// app.use('/api/v1/appointments', appointmentRoutes);
// app.use('/api/v1/doctors', doctorRoutes);
// app.use('/api/v1/pharmacy', pharmacyRoutes);
// app.use('/api/v1/lab', labRoutes);
// app.use('/api/v1/financial', financialRoutes);
// app.use('/api/v1/interactions', interactionRoutes);
// app.use('/api/v1/dashboard', dashboardRoutes);
// app.use('/api/v1/dispenselog', dispenseRoutes);
// app.use('/api/v1/services', servicesRoutes);

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//     environment: config.NODE_ENV
//   });
// });

// // Swagger API documentation
// if (config.NODE_ENV !== 'production') {
//   const swaggerJsdoc = require('swagger-jsdoc');
//   const swaggerUi = require('swagger-ui-express');
  
//   const swaggerOptions = {
//     swaggerDefinition: {
//       openapi: '3.0.0',
//       info: {
//         title: 'Hospital Management API',
//         version: '1.0.0',
//         description: 'Comprehensive API for hospital management system',
//         contact: {
//           name: 'API Support',
//           email: 'support@hospital.com'
//         }
//       },
//       servers: [
//         { url: `http://localhost:${config.PORT}`, description: 'Development server' },
//         { url: 'https://api.hospital.com', description: 'Production server' }
//       ],
//       components: {
//         securitySchemes: {
//           bearerAuth: {
//             type: 'http',
//             scheme: 'bearer',
//             bearerFormat: 'JWT'
//           }
//         }
//       },
//       security: [{ bearerAuth: [] }]
//     },
//     apis: ['./routes/*.js', './swagger/*.yaml']
//   };

//   const swaggerSpec = swaggerJsdoc(swaggerOptions);
//   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// }

// // Error handler middleware
// app.use(errorHandler);

// // Start cron jobs
// startORAutoReleaseCron();
// cleaningToAvailableCron();

// const PORT = config.PORT || 5000;

// const server = app.listen(PORT, async () => {
//   console.log(`Server running in ${config.NODE_ENV} mode on port ${PORT}`.yellow.bold);
  
//   // Run startup routine
//   await app.startup();
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (err, promise) => {
//   console.error(`Unhandled Rejection at: ${promise}`.red, `Reason: ${err.message}`.red);
//   if (server) {
//     server.close(() => process.exit(1));
//   } else {
//     process.exit(1);
//   }
// });

// // Handle SIGTERM for graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('SIGTERM received. Shutting down gracefully...');
//   server.close(() => {
//     console.log('Process terminated');
//     process.exit(0);
//   });
// });
