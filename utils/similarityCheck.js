const Service = require('../models/services.model');
const { distance } = require('fastest-levenshtein');

const checkSimilarity = async (name, excludeId = null) => {
  const services = await Service.find({ 
    isActive: true,
    ...(excludeId && { _id: { $ne: excludeId } })
  });
  
  return services.filter(service => {
    const similarity = distance(name.toLowerCase(), service.name.toLowerCase());
    const length = Math.max(name.length, service.name.length);
    return (length - similarity) / length > 0.8; // 80% similarity threshold
  });
};

module.exports = { checkSimilarity };