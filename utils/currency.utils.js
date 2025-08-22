// currency.utils.js
const currencyDetails = {
  USD: { symbol: '$', decimalDigits: 2, baseUnit: 100 },
  EUR: { symbol: '€', decimalDigits: 2, baseUnit: 100 },
  UGX: { symbol: 'USh', decimalDigits: 0, baseUnit: 1 },
  JPY: { symbol: '¥', decimalDigits: 0, baseUnit: 1 },
  GBP: { symbol: '£', decimalDigits: 2, baseUnit: 100 }
};

exports.getCurrencyInfo = (currencyCode = 'USD') => {
  return currencyDetails[currencyCode?.toUpperCase()] || currencyDetails.USD;
};

exports.toStorageFormat = (amount, currencyCode) => {
  const { baseUnit } = exports.getCurrencyInfo(currencyCode);
  const numericAmount = Number(amount) || 0;
  return Math.round(numericAmount * baseUnit);
};

exports.fromStorageFormat = (amount, currencyCode) => {
  const { baseUnit } = exports.getCurrencyInfo(currencyCode);
  const numericAmount = Number(amount) || 0;
  return numericAmount / baseUnit;
};






// const currencyDetails = {
//   USD: { symbol: '$', decimalDigits: 2, baseUnit: 100 },
//   EUR: { symbol: '€', decimalDigits: 2, baseUnit: 100 },
//   UGX: { symbol: 'USh', decimalDigits: 0, baseUnit: 1 }, // No decimals
//   KES: { symbol: 'KSh', decimalDigits: 2, baseUnit: 100 },
//   GBP: { symbol: '£', decimalDigits: 2, baseUnit: 100 },
//   JPY: { symbol: '¥', decimalDigits: 0, baseUnit: 1 }
// };

// exports.getCurrencyInfo = (currencyCode) => {
//   const code = currencyCode?.toUpperCase();
//   return currencyDetails[code] || currencyDetails.USD;
// };

// exports.toStorageFormat = (amount, currencyCode) => {
//   const { baseUnit } = exports.getCurrencyInfo(currencyCode);
//   const numericAmount = Number(amount) || 0;
//   return Math.round(numericAmount * baseUnit);
// };

// exports.fromStorageFormat = (amount, currencyCode) => {
//   const { baseUnit } = exports.getCurrencyInfo(currencyCode);
//   const numericAmount = Number(amount) || 0;
//   return numericAmount / baseUnit;
// };

// // Optional: Format for display with proper decimal places
// exports.formatForDisplay = (amount, currencyCode) => {
//   const { decimalDigits } = exports.getCurrencyInfo(currencyCode);
//   const numericAmount = Number(amount) || 0;
//   return parseFloat(numericAmount.toFixed(decimalDigits));
// };

