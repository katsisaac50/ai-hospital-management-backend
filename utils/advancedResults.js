class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 25;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  enableGetters() {
    this.query = this.query.setOptions({ getters: true });
    return this;
  }
}

const advancedResults = (model, populate) => async (req, res, next) => {
  try {
    // Execute query
    let query = new APIFeatures(model.find(), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate()
      .enableGetters();

    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach((p) => {
          query.query = populate.reduce((acc, p) => acc.populate(p), query.query);
        });
      } else {
        query.query = query.query.populate(populate);
      }
    }

    const results = await query.query;

    res.advancedResults = {
      success: true,
      count: results.length,
      data: results,
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = advancedResults;

// const advancedResults = (model, populate) => async (req, res, next) => {
//   try {
//     let query = model.find();

//     // Optional population
//     if (populate) {
//       query = query.populate(populate);
//     }

//     const results = await query;

//     res.advancedResults = {
//       success: true,
//       count: results.length,
//       data: results,
//     };

//     next();
//   } catch (err) {
//     console.error("Advanced results error:", err);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };

// module.exports = advancedResults;


// class APIFeatures {
//   constructor(query, queryString) {
//     this.query = query;
//     this.queryString = queryString;
//   }

//   filter() {
//     const queryObj = { ...this.queryString };
//     const excludedFields = ['page', 'sort', 'limit', 'fields'];
//     excludedFields.forEach((el) => delete queryObj[el]);

//     // Advanced filtering
//     let queryStr = JSON.stringify(queryObj);
//     queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

//     this.query = this.query.find(JSON.parse(queryStr));

//     return this;
//   }

//   sort() {
//     if (this.queryString.sort) {
//       const sortBy = this.queryString.sort.split(',').join(' ');
//       this.query = this.query.sort(sortBy);
//     } else {
//       this.query = this.query.sort('-createdAt');
//     }

//     return this;
//   }

//   limitFields() {
//     if (this.queryString.fields) {
//       const fields = this.queryString.fields.split(',').join(' ');
//       this.query = this.query.select(fields);
//     } else {
//       this.query = this.query.select('-__v');
//     }

//     return this;
//   }

//   paginate() {
//     const page = this.queryString.page * 1 || 1;
//     const limit = this.queryString.limit * 1 || 25;
//     const skip = (page - 1) * limit;

//     this.query = this.query.skip(skip).limit(limit);

//     return this;
//   }
// }

// const advancedResults = (model, populate) => async (req, res, next) => {
//   try {
//     // Execute query
//     let query = new APIFeatures(model.find(), req.query)
//       .filter()
//       .sort()
//       .limitFields()
//       .paginate();

//     if (populate) {
//       query = query.query.populate(populate);
//     }

//     const results = await query.query;

//     res.advancedResults = {
//       success: true,
//       count: results.length,
//       data: results,
//     };

//     next();
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = advancedResults;
