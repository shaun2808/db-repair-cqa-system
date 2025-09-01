// Central exports for all utility functions

// Data parsing utilities
export {
  parseCSV,
  parseJSON,
  detectTypes,
  normalizeType
} from './dataParser.js';

// Type detection utilities
export {
  detectColumnType
} from './typeDetection.js';

// Violation checking utilities
export {
  checkForeignKeyViolations,
  checkViolations,
  checkRepairFileViolations
} from './violationChecker.js';

// Repair generation utilities
export {
  generateForeignKeyRepairs,
  generatePrimaryKeyRepairs,
  generateGeneralRepairs,
  generatePartialRepairs,
  addCustomRepairOption
} from './repairGenerator.js';

// Export utilities
export {
  getExportFileName,
  exportCSV,
  exportJSON,
  exportMySQL
} from './exportUtils.js';

// SQL utilities
export {
  runSqlQuery
} from './sqlUtils.js';

// Edit utilities
export {
  saveToBackend,
  validateEntry,
  updateViolationsAfterDelete,
  isCustomRepair,
  calculateViolationPositions
} from './editUtils.js';
