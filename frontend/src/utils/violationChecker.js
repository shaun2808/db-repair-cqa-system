// Utilities for checking data violations and foreign key constraints

/**
 * Validate if a value matches the expected SQL data type
 * @param {string} value - The value to validate
 * @param {string} sqlType - The SQL data type (INT, VARCHAR, etc.)
 * @returns {boolean} - True if value is valid for the type
 */
function validateDataType(value, sqlType) {
  // Empty or null values are handled by NOT NULL constraint separately
  if (value === '' || value == null) return true;
  
  const trimmedVal = String(value).trim();
  if (trimmedVal === '') return true;
  
  switch (sqlType?.toUpperCase()) {
    case 'INT':
    case 'INTEGER':
    case 'BIGINT':
      // Check if it's a valid integer
      const num = parseFloat(trimmedVal);
      const isValid = !isNaN(num) && isFinite(num) && Number.isInteger(num) && /^-?\d+$/.test(trimmedVal);
      return isValid;
      
    case 'FLOAT':
    case 'DOUBLE':
    case 'DECIMAL':
    case 'NUMERIC':
      // Check if it's a valid number
      return !isNaN(parseFloat(trimmedVal)) && isFinite(trimmedVal);
      
    case 'BOOLEAN':
    case 'BOOL':
      // Check if it's a valid boolean representation
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(trimmedVal.toLowerCase());
      
    case 'DATE':
    case 'DATETIME':
    case 'TIMESTAMP':
      // Check if it's a valid date
      return !isNaN(Date.parse(trimmedVal));
      
    case 'VARCHAR':
    case 'TEXT':
    case 'CHAR':
    case 'STRING':
    default:
      // String types are always valid
      return true;
  }
}

/**
 * Check for foreign key violations
 * @param {Array} foreignRows - Rows from the foreign table
 * @param {Array} primaryRows - Rows from the primary table
 * @param {string} fkCol - Foreign key column name
 * @param {string} pkCol - Primary key column name
 * @returns {Array} - Array of violation objects
 */
export function checkForeignKeyViolations(foreignRows, primaryRows, fkCol, pkCol) {
  if (!foreignRows || !primaryRows || !fkCol || !pkCol) {
    return [];
  }

  const primarySet = new Set();
  
  // Convert values to strings for comparison and filter out empty values
  primaryRows.forEach(row => {
    const val = row[pkCol];
    if (val !== undefined && val !== null && val !== '') {
      primarySet.add(String(val).trim());
    }
  });

  const violations = [];
  
  foreignRows.forEach((row, i) => {
    const fkVal = row[fkCol];
    // Skip empty values
    if (fkVal === undefined || fkVal === null || fkVal === '') return;
    
    // Convert to string and trim for comparison
    const fkValStr = String(fkVal).trim();
    if (!primarySet.has(fkValStr)) {
      violations.push({ 
        row: i + 1, 
        col: fkCol, 
        type: 'FOREIGN KEY', 
        value: fkVal,
        msg: `Value '${fkVal}' not found in primary key column` 
      });
    }
  });

  return violations;
}

/**
 * Check for general data violations (primary key, unique, not null, type mismatch)
 * @param {Array} tableData - Table data to check
 * @param {Array} confirmedConstraints - Array of constraint arrays for each column
 * @param {Object} fileTables - All file tables for foreign key checks
 * @param {Object} foreignKeyConfig - Foreign key configuration
 * @param {Array} confirmedTypes - Array of SQL data types for each column
 * @returns {Array} - Array of violation objects
 */
export function checkViolations(tableData, confirmedConstraints, fileTables, foreignKeyConfig, confirmedTypes = []) {
  if (!tableData.length || !confirmedConstraints.length) return [];
  
  const columns = Object.keys(tableData[0]);
  const violations = [];
  
  columns.forEach((col, idx) => {
    const constraints = confirmedConstraints[idx] || [];
    const dataType = confirmedTypes[idx] || 'VARCHAR';
    
    // Check for type mismatches
    tableData.forEach((row, i) => {
      const val = row[col];
      const isValidType = validateDataType(val, dataType);
      
      if (!isValidType) {
        const violation = { 
          row: i + 1, 
          col, 
          type: 'TYPE MISMATCH', 
          msg: `Type mismatch: expected ${dataType}, got "${val}"` 
        };
        violations.push(violation);
      }
    });
    
    if (constraints.includes('primary')) {
      const seen = new Set();
      tableData.forEach((row, i) => {
        const val = row[col];
        if (val === '' || val == null) {
          violations.push({ row: i + 1, col, type: 'PRIMARY KEY', msg: 'Null/empty value' });
        } else if (seen.has(val)) {
          violations.push({ row: i + 1, col, type: 'PRIMARY KEY', msg: 'Duplicate value' });
        } else {
          seen.add(val);
        }
      });
    }
    
    if (constraints.includes('unique')) {
      const seen = new Set();
      tableData.forEach((row, i) => {
        const val = row[col];
        if (val !== '' && val != null) {
          if (seen.has(val)) {
            violations.push({ row: i + 1, col, type: 'UNIQUE', msg: 'Duplicate value' });
          } else {
            seen.add(val);
          }
        }
      });
    }
    
    if (constraints.includes('notnull')) {
      tableData.forEach((row, i) => {
        const val = row[col];
        if (val === '' || val == null) {
          violations.push({ row: i + 1, col, type: 'NOT NULL', msg: 'Null/empty value' });
        }
      });
    }
  });

  // Foreign key violation check
  if (foreignKeyConfig && foreignKeyConfig.primaryFile && foreignKeyConfig.fkCol && foreignKeyConfig.referencedFile) {
    const primaryTable = fileTables[foreignKeyConfig.primaryFile];
    const foreignTable = fileTables[foreignKeyConfig.referencedFile];
    if (primaryTable && foreignTable) {
      const fkCol = foreignKeyConfig.fkCol;
      // Try to find a primary key column in the primary table (first column with 'primary' constraint, else first column)
      let pkCol = null;
      if (primaryTable.columns && primaryTable.columns.length > 0) {
        // Try to find a column with 'primary' constraint
        const primaryIdx = primaryTable.columns.findIndex((col, idx) => {
          const constraints = confirmedConstraints[idx] || [];
          return constraints.includes('primary');
        });
        if (primaryIdx !== -1) {
          pkCol = primaryTable.columns[primaryIdx];
        } else {
          pkCol = primaryTable.columns[0];
        }
      }
      const violationsFK = checkForeignKeyViolations(
        foreignTable.rows,
        primaryTable.rows,
        fkCol,
        pkCol
      );
      violations.push(...violationsFK.map(v => ({
        row: v.row,
        col: fkCol,  // Use the foreign key column name consistently
        type: 'FOREIGN KEY',
        msg: `Value '${v.value}' not found in ${foreignKeyConfig.primaryFile}.${pkCol}`
      })));
    }
  }
  
  return violations;
}

/**
 * Check violations for a specific repair file
 * @param {Object} repairFile - Repair file object with rows and columns
 * @param {Array} confirmedConstraints - Array of constraint arrays for each column
 * @returns {Array} - Array of violation objects
 */
export function checkRepairFileViolations(repairFile, confirmedConstraints, fileTables = null, foreignKeyConfig = null, confirmedTypes = []) {
  if (!repairFile || !repairFile.rows || !repairFile.columns) return [];
  
  const { columns, rows } = repairFile;
  // Use the repair file's types if available, otherwise fall back to confirmedTypes
  const typesToUse = repairFile.types || confirmedTypes;
  const violations = [];
  
  columns.forEach((col, idx) => {
    const constraints = confirmedConstraints[idx] || [];
    const dataType = typesToUse[idx] || 'VARCHAR';
    
    // Check for type mismatches
    rows.forEach((row, i) => {
      const val = row[col];
      const isValid = validateDataType(val, dataType);
      
      if (!isValid) {
        violations.push({ 
          row: i + 1, 
          col, 
          type: 'TYPE MISMATCH', 
          msg: `Invalid ${dataType} value: "${val}"` 
        });
      }
    });
    
    if (constraints.includes('primary')) {
      const seen = new Set();
      rows.forEach((row, i) => {
        const val = row[col];
        if (val === '' || val == null) {
          violations.push({ row: i + 1, col, type: 'PRIMARY KEY', msg: 'Null/empty value' });
        } else if (seen.has(val)) {
          violations.push({ row: i + 1, col, type: 'PRIMARY KEY', msg: 'Duplicate value' });
        } else {
          seen.add(val);
        }
      });
    }
    
    if (constraints.includes('unique')) {
      const seen = new Set();
      rows.forEach((row, i) => {
        const val = row[col];
        if (val !== '' && val != null) {
          if (seen.has(val)) {
            violations.push({ row: i + 1, col, type: 'UNIQUE', msg: 'Duplicate value' });
          } else {
            seen.add(val);
          }
        }
      });
    }
    
    if (constraints.includes('notnull')) {
      rows.forEach((row, i) => {
        const val = row[col];
        if (val === '' || val == null) {
          violations.push({ row: i + 1, col, type: 'NOT NULL', msg: 'Null/empty value' });
        }
      });
    }
  });
  
  // Check for foreign key violations if configuration is provided
  if (foreignKeyConfig && fileTables && 
      foreignKeyConfig.primaryFile && foreignKeyConfig.fkCol && foreignKeyConfig.referencedFile) {
    
    const primaryTable = fileTables[foreignKeyConfig.primaryFile];
    const fkCol = foreignKeyConfig.fkCol;
    
    // Check if this repair file corresponds to the foreign table
    // Custom repair files have names like "orders.csv_repair_custom.csv" for original file "orders.csv"
    let isReferencedTable = false;
    if (repairFile.name === foreignKeyConfig.referencedFile) {
      isReferencedTable = true;
    } else if (repairFile.name.includes('_repair_custom')) {
      // Extract the base name from the repair file: "orders.csv_repair_custom.csv" -> "orders.csv"
      const baseName = repairFile.name.replace('_repair_custom.csv', '');
      isReferencedTable = baseName === foreignKeyConfig.referencedFile;
    }
    
    if (primaryTable && primaryTable.rows && isReferencedTable) {
      // Find primary key column in the primary table - use first column as default
      let pkCol = null;
      if (primaryTable.columns && primaryTable.columns.length > 0) {
        // For simplicity, assume the first column is the primary key
        // This matches the original logic in checkViolations
        pkCol = primaryTable.columns[0];
      }
      
      if (pkCol) {
        // Use the existing checkForeignKeyViolations function
        const fkViolations = checkForeignKeyViolations(
          rows,
          primaryTable.rows,
          fkCol,
          pkCol
        );
        violations.push(...fkViolations.map(v => ({
          row: v.row,
          col: fkCol,
          type: 'FOREIGN KEY',
          value: v.value,
          msg: `Value '${v.value}' not found in ${foreignKeyConfig.primaryFile}.${pkCol}`
        })));
      }
    }
  }
  
  return violations;
}
