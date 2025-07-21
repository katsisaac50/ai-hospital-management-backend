const DrugInteraction = require('../models/drug-interaction.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all drug interactions
// @route   GET /api/v1/interactions
// @access  Private
exports.getAllInteractions = asyncHandler(async (req, res, next) => {
  const interactions = await DrugInteraction.find();
  res.status(200).json({
    success: true,
    count: interactions.length,
    data: interactions,
  });
});



// @desc    Check drug interactions (local DB)
// @route   POST /api/v1/interactions/check
// @access  Private
exports.checkInteraction = asyncHandler(async (req, res, next) => {
  
  const { drugs } = req.body;

  if (!Array.isArray(drugs) || drugs.length < 2) {
    return next(new ErrorResponse('At least two drug names are required', 400));
  }

  const normalized = drugs.map(d => d.trim().toLowerCase());

  // Find all possible pairs
  const pairs = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      pairs.push([normalized[i], normalized[j]]);
    }
  }

  const interactions = [];

  // Search the DB for matching pairs
  for (const [a, b] of pairs) {
    const match = await DrugInteraction.findOne({
      $or: [
        { drugA: a, drugB: b },
        { drugA: b, drugB: a },
      ],
    });

    if (match) {
      interactions.push(`${capitalize(match.drugA)} ↔ ${capitalize(match.drugB)}: ${match.description}`);
    }
  }
console.log(interactions)
  res.status(200).json({ interactions });
});

// Helper function to capitalize first letter
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// @desc    Get a specific interaction by drug pair
// @route   GET /api/v1/interactions/check?drug1=ibuprofen&drug2=aspirin
// @access  Private
// exports.checkInteraction = asyncHandler(async (req, res, next) => {
//   const { drug1, drug2 } = req.query;

//   if (!drug1 || !drug2) {
//     return next(new ErrorResponse('Both drug1 and drug2 are required', 400));
//   }

//   const interaction = await DrugInteraction.findOne({
//     $or: [
//       { drugA: drug1.toLowerCase(), drugB: drug2.toLowerCase() },
//       { drugA: drug2.toLowerCase(), drugB: drug1.toLowerCase() },
//     ],
//   });

//   if (!interaction) {
//     return res.status(200).json({
//       success: true,
//       interaction: false,
//       message: 'No known interaction found between the selected drugs',
//     });
//   }

//   res.status(200).json({
//     success: true,
//     interaction: true,
//     data: {
//       drugA: interaction.drugA,
//       drugB: interaction.drugB,
//       description: interaction.description,
//       severity: interaction.severity,
//     },
//   });
// });

// @desc    Create a new drug interaction
// @route   POST /api/v1/interactions
// @access  Private
exports.createInteraction = asyncHandler(async (req, res, next) => {
  const { drugA, drugB, description, severity } = req.body;

  if (!drugA || !drugB || !description) {
    return next(new ErrorResponse('drugA, drugB, and description are required', 400));
  }

  const exists = await DrugInteraction.findOne({
    $or: [
      { drugA: drugA.toLowerCase(), drugB: drugB.toLowerCase() },
      { drugA: drugB.toLowerCase(), drugB: drugA.toLowerCase() },
    ],
  });

  if (exists) {
    return next(new ErrorResponse('Interaction already exists between these drugs', 400));
  }

  const interaction = await DrugInteraction.create({
    drugA: drugA.toLowerCase(),
    drugB: drugB.toLowerCase(),
    description,
    severity,
  });

  res.status(201).json({
    success: true,
    data: interaction,
  });
});

// @desc    Delete a drug interaction by ID
// @route   DELETE /api/v1/interactions/:id
// @access  Private
exports.deleteInteraction = asyncHandler(async (req, res, next) => {
  const interaction = await DrugInteraction.findByIdAndDelete(req.params.id);

  if (!interaction) {
    return next(
      new ErrorResponse(`Interaction not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});
