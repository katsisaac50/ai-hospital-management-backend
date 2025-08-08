const express = require('express');
const router = express.Router();
const {
  getServices,
  getService,
  createService,
  updateService,
  deactivateService,
  getServiceActivities
} = require('../controllers/services.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async');
const { check } = require('express-validator');

// Include other resource routers (if needed)
// const prescriptionRouter = require('./prescriptions');

// Re-route into other resource routers
// router.use('/:serviceId/prescriptions', prescriptionRouter);

// Public routes
router.route('/')
  .get(getServices);

router.route('/:id')
  .get(getService);

// Protected admin routes
router.route('/')
  .post(
    protect,
    authorize('admin'),
    [
      check('name', 'Name is required (3-100 characters)')
        .trim()
        .notEmpty()
        .isLength({ min: 3, max: 100 }),
      check('code', 'Code is required (3-10 uppercase alphanumeric characters)')
        .trim()
        .notEmpty()
        .isLength({ min: 3, max: 10 })
        .matches(/^[A-Z0-9]+$/),
      check('price', 'Valid price is required (0-100,000)')
        .isFloat({ min: 0, max: 100000 }),
      check('category', 'Valid category is required')
        .isIn(['consultation', 'diagnostic', 'treatment', 'procedure', 'other'])
    ],
    createService
  );

router.route('/:id')
  .put(
    protect,
    authorize('admin'),
    [
      check('name', 'Name must be 3-100 characters)')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 }),
      check('code', 'Code must be 3-10 uppercase alphanumeric characters)')
        .optional()
        .trim()
        .isLength({ min: 3, max: 10 })
        .matches(/^[A-Z0-9]+$/),
      check('price', 'Price must be between 0-100,000')
        .optional()
        .isFloat({ min: 0, max: 100000 }),
      check('category', 'Invalid category')
        .optional()
        .isIn(['consultation', 'diagnostic', 'treatment', 'procedure', 'other']),
      check('isActive', 'isActive must be boolean')
        .optional()
        .isBoolean()
    ],
    updateService
  )
  .delete(
    protect,
    authorize('admin'),
    deactivateService
  );

router.route('/:id/activities')
  .get(
    protect,
    authorize('admin', 'pharmacist'),
    getServiceActivities
  );

// Advanced filtering route
// GET /api/v1/services/search?name=consult&category=consultation
// GET /api/v1/services/search?minPrice=50&maxPrice=200
// GET /api/v1/services/search?page=2&limit=10
// GET /api/v1/services/search?fields=name,price&sort=-price
// GET /api/v1/services/search?category=consultation,diagnostic&minPrice=100&isActive=true
router.route('/search')
  .get(
    protect,
    authorize('admin', 'doctor', 'pharmacist'),
    asyncHandler(async (req, res, next) => {
      // Input validation
      const { minPrice, maxPrice, page, limit } = req.query;
      
      if (minPrice && isNaN(minPrice)) {
        return next(new ErrorResponse('minPrice must be a number', 400));
      }
      
      if (maxPrice && isNaN(maxPrice)) {
        return next(new ErrorResponse('maxPrice must be a number', 400));
      }
      
      if (page && isNaN(page)) {
        return next(new ErrorResponse('page must be a number', 400));
      }
      
      if (limit && isNaN(limit)) {
        return next(new ErrorResponse('limit must be a number', 400));
      }
      
      await getFilteredServices(req, res, next);
    })
  );

module.exports = router;