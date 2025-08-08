const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const Service = require('../models/services.model');
const moment = require('moment');
const { checkSimilarity } = require('../utils/similarityCheck');

// @desc    Get all services
// @route   GET /api/v1/services
// @access  Public
exports.getServices = asyncHandler(async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true })
      .sort({ name: 1 })
      .select('-__v');

    console.log("Fetched services:", { count: services.length });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error("Failed to fetch services:", error.message);
    next(new ErrorResponse('Failed to retrieve services', 500));
  }
});

// @desc    Get single service
// @route   GET /api/v1/services/:id
// @access  Public
exports.getService = asyncHandler(async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id)
      .select('-__v');

    if (!service) {
      return next(new ErrorResponse(`Service not found with id ${req.params.id}`, 404));
    }

    console.log("Fetched service:", { id: service._id, name: service.name });

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error("Failed to fetch service:", error.message);
    next(new ErrorResponse('Failed to retrieve service', 500));
  }
});

// @desc    Create new service
// @route   POST /api/v1/services
// @access  Private/Admin
exports.createService = asyncHandler(async (req, res, next) => {
  console.log('ghit services.controller.js - createService called with body:', req.body);
  try {
    const { name, code, price, description, category } = req.body;

    // Check for existing service with same name or code
    const existingService = await Service.findOne({
      $or: [
        { name: new RegExp(`^${name}$`, 'i') },
        { code: new RegExp(`^${code}$`, 'i') }
      ]
    });

    if (existingService) {
      return next(new ErrorResponse('Service with this name or code already exists', 400));
    }

    // Check for similar services
    const similarServices = await checkSimilarity(name);
    if (similarServices.length > 0) {
      return next(new ErrorResponse(
        `Service name is too similar to existing services: ${similarServices.map(s => s.name).join(', ')}`, 
        400
      ));
    }

    const service = await Service.create({
      name,
      code,
      price,
      description,
      category
    });

    console.log("Created new service:", { id: service._id, name: service.name });

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error("Failed to create service:", error.message);
    next(new ErrorResponse('Failed to create service', 500));
  }
});

// @desc    Update service
// @route   PUT /api/v1/services/:id
// @access  Private/Admin
exports.updateService = asyncHandler(async (req, res, next) => {
  try {
    let service = await Service.findById(req.params.id);

    if (!service) {
      return next(new ErrorResponse(`Service not found with id ${req.params.id}`, 404));
    }

    // Check for uniqueness if name/code is being updated
    if (req.body.name || req.body.code) {
      const existingService = await Service.findOne({
        $and: [
          { _id: { $ne: req.params.id } },
          { 
            $or: [
              { name: new RegExp(`^${req.body.name || service.name}$`, 'i') },
              { code: new RegExp(`^${req.body.code || service.code}$`, 'i') }
            ]
          }
        ]
      });

      if (existingService) {
        return next(new ErrorResponse('Service with this name or code already exists', 400));
      }
    }

    // Check for similarity if name is being updated
    if (req.body.name) {
      const similarServices = await checkSimilarity(req.body.name, req.params.id);
      if (similarServices.length > 0) {
        return next(new ErrorResponse(
          `Service name is too similar to existing services: ${similarServices.map(s => s.name).join(', ')}`, 
          400
        ));
      }
    }

    service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    console.log("Updated service:", { id: service._id, name: service.name });

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error("Failed to update service:", error.message);
    next(new ErrorResponse('Failed to update service', 500));
  }
});

// @desc    Deactivate service
// @route   DELETE /api/v1/services/:id
// @access  Private/Admin
exports.deactivateService = asyncHandler(async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!service) {
      return next(new ErrorResponse(`Service not found with id ${req.params.id}`, 404));
    }

    console.log("Deactivated service:", { id: service._id, name: service.name });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error("Failed to deactivate service:", error.message);
    next(new ErrorResponse('Failed to deactivate service', 500));
  }
});

// @desc    Get service activities/logs
// @route   GET /api/v1/services/:id/activities
// @access  Private/Admin
exports.getServiceActivities = asyncHandler(async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return next(new ErrorResponse(`Service not found with id ${req.params.id}`, 404));
    }

    // In a real implementation, you would query your activity logs
    const activities = [
      {
        id: '1',
        type: 'created',
        description: `Service "${service.name}" was created`,
        time: moment(service.createdAt).fromNow(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'updated',
        description: `Price updated to $${service.price}`,
        time: moment(service.updatedAt).fromNow(),
        status: 'completed'
      }
    ];

    console.log("Fetched service activities:", { 
      serviceId: service._id, 
      activityCount: activities.length 
    });

    res.status(200).json(activities);
  } catch (error) {
    console.error("Failed to fetch service activities:", error.message);
    next(new ErrorResponse('Failed to retrieve service activities', 500));
  }
});

// @desc    Advanced filtered services search
// @route   GET /api/v1/services/search
// @access  Private
exports.getFilteredServices = asyncHandler(async (req, res, next) => {
  try {
    // Extract query parameters
    const { name, code, minPrice, maxPrice, category, isActive, sort, fields, limit, page } = req.query;
    
    // 1. Build the query
    const queryObj = {};
    
    // Name filtering (case insensitive partial match)
    if (name) {
      queryObj.name = { $regex: name, $options: 'i' };
    }
    
    // Exact code match
    if (code) {
      queryObj.code = code.toUpperCase();
    }
    
    // Price range filtering
    if (minPrice || maxPrice) {
      queryObj.price = {};
      if (minPrice) queryObj.price.$gte = Number(minPrice);
      if (maxPrice) queryObj.price.$lte = Number(maxPrice);
    }
    
    // Category filtering
    if (category) {
      queryObj.category = { $in: category.split(',') };
    }
    
    // Active status filtering
    if (isActive) {
      queryObj.isActive = isActive === 'true';
    }
    
    console.log("Filter criteria:", queryObj);
    
    // 2. Execute query
    let query = Service.find(queryObj);
    
    // 3. Sorting
    if (sort) {
      const sortBy = sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt'); // default sort
    }
    
    // 4. Field limiting
    if (fields) {
      const select = fields.split(',').join(' ');
      query = query.select(select);
    } else {
      query = query.select('-__v'); // exclude version key by default
    }
    
    // 5. Pagination
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 25;
    const skipNum = (pageNum - 1) * limitNum;
    
    query = query.skip(skipNum).limit(limitNum);
    
    // 6. Get total count for pagination info
    const total = await Service.countDocuments(queryObj);
    
    // Execute final query
    const services = await query;
    
    console.log("Filtered services result:", { 
      results: services.length,
      filters: Object.keys(queryObj).length 
    });
    
    // 7. Prepare response with pagination info
    const pagination = {};
    
    if (skipNum + limitNum < total) {
      pagination.next = {
        page: pageNum + 1,
        limit: limitNum
      };
    }
    
    if (skipNum > 0) {
      pagination.prev = {
        page: pageNum - 1,
        limit: limitNum
      };
    }
    
    res.status(200).json({
      success: true,
      count: services.length,
      pagination,
      total,
      data: services
    });
    
  } catch (error) {
    console.error("Advanced service search failed:", error.message);
    next(new ErrorResponse('Advanced search failed', 500));
  }
});