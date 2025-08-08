const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const ErrorResponse = require('../utils/errorResponse');
const config = require('../config/env');

// Protect routes
exports.protect = async (req, res, next) => {
  // console.log('auth middleware protect called', req.headers);
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } console.log('token', token);

  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // 3. Get user from database
    const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');
    console.log('currentUser', currentUser);
    if (!currentUser) {
      return next(new ErrorResponse('User no longer exists', 401));
    }

    // 4. Check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        error: 'User recently changed password. Please log in again.'
      })
    }

    // req.user = await User.findById(decoded.id);

    // 5. Grant access
    req.user = currentUser;

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};
