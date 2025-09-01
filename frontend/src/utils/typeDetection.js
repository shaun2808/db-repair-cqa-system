// Utilities for detecting column types

/**
 * Enhanced type detection function for column data
 * @param {Array} values - Array of values to analyze
 * @returns {string} - Detected type (TEXT, INTEGER, DECIMAL, DATE, TIME, DATETIME, BOOLEAN)
 */
export function detectColumnType(values) {
  // Remove null/empty values
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmptyValues.length === 0) return 'TEXT';

  // Check if all values are valid numbers
  const numberTest = nonEmptyValues.every(v => !isNaN(v) && !isNaN(parseFloat(v)));
  if (numberTest) {
    // Check if all values are integers
    const integerTest = nonEmptyValues.every(v => Number.isInteger(Number(v)));
    return integerTest ? 'INTEGER' : 'DECIMAL';
  }

  // Check for DATE format (various common formats)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{2}\/\d{2}\/\d{4}$/ // DD/MM/YYYY
  ];
  const dateTest = nonEmptyValues.every(v => 
    datePatterns.some(pattern => pattern.test(String(v))) ||
    !isNaN(Date.parse(v))
  );
  if (dateTest) return 'DATE';

  // Check for TIME format
  const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  const timeTest = nonEmptyValues.every(v => timePattern.test(String(v)));
  if (timeTest) return 'TIME';

  // Check for DATETIME
  const datetimeTest = nonEmptyValues.every(v => !isNaN(Date.parse(v)));
  if (datetimeTest) return 'DATETIME';

  // Check for BOOLEAN
  const booleanValues = ['true', 'false', '1', '0', 'yes', 'no'];
  const booleanTest = nonEmptyValues.every(v => 
    booleanValues.includes(String(v).toLowerCase())
  );
  if (booleanTest) return 'BOOLEAN';

  // Default to TEXT
  return 'TEXT';
}
