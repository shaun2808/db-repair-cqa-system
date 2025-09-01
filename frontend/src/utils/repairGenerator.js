// Utilities for generating repair files and strategies
import { checkForeignKeyViolations } from './violationChecker.js';

/**
 * Generate repair files for foreign key violations
 * @param {Object} foreignKeyConfig - Foreign key configuration
 * @param {Object} fileTables - All file tables
 * @param {Array} confirmedConstraints - Array of constraint arrays
 * @returns {Array} - Array of repair file objects
 */
export function generateForeignKeyRepairs(foreignKeyConfig, fileTables, confirmedConstraints) {
  const { primaryFile, fkCol, referencedFile } = foreignKeyConfig;
  const foreignTable = fileTables[referencedFile];
  const primaryTable = fileTables[primaryFile];
  
  if (!foreignTable || !primaryTable) {
    return [];
  }

  // Find the primary key column
  let pkCol = null;
  if (primaryTable.columns && primaryTable.columns.length > 0) {
    const primaryIdx = primaryTable.columns.findIndex((col, idx) => {
      const constraints = confirmedConstraints[idx] || [];
      return constraints.includes('primary');
    });
    pkCol = primaryIdx !== -1 ? primaryTable.columns[primaryIdx] : primaryTable.columns[0];
  }

  // Get violations
  const violationsFK = checkForeignKeyViolations(
    foreignTable.rows,
    primaryTable.rows,
    fkCol,
    pkCol
  );

  if (violationsFK.length === 0) return [];

  const repairFileObjs = [];
  
  // 1. Delete strategy - remove violating rows
  const violatingRowIndices = new Set(violationsFK.map(v => v.row - 1));
  const validRows = foreignTable.rows.filter((_, index) => !violatingRowIndices.has(index));
  
  repairFileObjs.push({
    name: `${referencedFile}_repair_delete_${Date.now()}.csv`,
    rows: validRows,
    columns: foreignTable.columns,
    description: 'Removed rows with invalid foreign keys'
  });

  // 2. Custom repair option - keep all rows for manual editing
  repairFileObjs.push({
    name: `${referencedFile}_repair_custom.csv`,
    rows: [...foreignTable.rows],
    columns: foreignTable.columns,
    description: 'Manual editing option'
  });

  return repairFileObjs;
}

/**
 * Generate repair files for primary key violations
 * @param {Array} tableData - Table data
 * @param {Array} confirmedConstraints - Array of constraint arrays
 * @param {string} selectedFile - Selected file name
 * @returns {Array} - Array of repair file objects
 */
export function generatePrimaryKeyRepairs(tableData, confirmedConstraints, selectedFile) {
  const pkCols = confirmedConstraints
    .map((arr, idx) => arr.includes('primary') ? (tableData[0] && Object.keys(tableData[0])[idx]) : null)
    .filter(Boolean);
    
  let repairFileObjs = [];
  
  if (pkCols.length > 0) {
    const pkGroups = {};
    tableData.forEach(row => {
      const key = pkCols.map(col => row[col]).join('||');
      if (!pkGroups[key]) pkGroups[key] = [];
      pkGroups[key].push(row);
    });
    
    const groupChoices = Object.values(pkGroups).map(group => group);
    
    function cartesian(arr) {
      return arr.reduce((a, b) => a.flatMap(d => b.map(e => [].concat(d, e))), [[]]);
    }
    
    const allRepairs = cartesian(groupChoices);
    const seenRepairs = new Set();
    
    allRepairs.forEach((rows, idx) => {
      if (rows.length !== groupChoices.length) return;
      
      const filteredRows = rows.filter(row => {
        return Object.keys(row).every(col => {
          if (pkCols.includes(col)) return true;
          return row[col] !== '' && row[col] != null;
        });
      });
      
      if (filteredRows.length === 0) return;
      
      const key = JSON.stringify(filteredRows.map(r => Object.values(r)));
      if (seenRepairs.has(key)) return;
      seenRepairs.add(key);
      
      repairFileObjs.push({
        name: `${selectedFile || 'table'}_repair_${idx + 1}_${Date.now()}.csv`,
        rows: filteredRows,
        columns: Object.keys(tableData[0] || {})
      });
    });
  }
  
  return repairFileObjs;
}

/**
 * Generate partial repair files that handle both automatic repairs and editable violations
 * @param {Array} violations - Array of violation objects
 * @param {Array} tableData - Table data
 * @param {string} selectedFile - Selected file name
 * @param {Array} confirmedTypes - Array of confirmed data types
 * @returns {Array} - Array of partial repair file objects
 */
export function generatePartialRepairs(violations, tableData, selectedFile, confirmedTypes) {
  if (violations.length === 0) return [];
  
  const repairFileObjs = [];
  
  // Categorize violations
  const nullViolations = violations.filter(v => v.msg.includes('Null/empty value'));
  const duplicateViolations = violations.filter(v => v.msg.includes('Duplicate value'));
  const typeViolations = violations.filter(v => v.msg.includes('Type mismatch') || v.type === 'TYPE MISMATCH');
  
  // Only generate partial repairs if there are type mismatches (data that can't be auto-fixed)
  if (typeViolations.length === 0) {
    return [];
  }
  
  const nullRowIndices = new Set(nullViolations.map(v => v.row - 1));
  const duplicateRowIndices = new Set(duplicateViolations.map(v => v.row - 1));
  const typeViolatedRows = new Set(typeViolations.map(v => v.row - 1));

  // Partial Repair 1: Remove first duplicate and empty rows, keep type violations for editing
  if (duplicateViolations.length > 0 || nullViolations.length > 0) {
    const seenValues = new Map();
    const partialRepair1 = tableData.filter((row, idx) => {
      // Keep rows with type violations for manual editing
      if (typeViolatedRows.has(idx)) return true;
      
      // Remove null/empty rows
      if (nullRowIndices.has(idx)) return false;
      
      // For duplicates, keep first occurrence
      for (const col of new Set(duplicateViolations.map(v => v.col))) {
        const value = row[col];
        const key = `${col}:${value}`;
        
        if (seenValues.has(key)) {
          return false; // Skip subsequent duplicates
        }
        seenValues.set(key, idx);
      }
      return true;
    });
    
    // Mark rows that need editing
    const rowsNeedingEdit = partialRepair1.map((row, idx) => {
      const originalIdx = tableData.indexOf(row);
      return {
        ...row,
        _needsEdit: typeViolatedRows.has(originalIdx),
        _violationReasons: typeViolations
          .filter(v => v.row - 1 === originalIdx)
          .map(v => `${v.col}: ${v.msg}`)
      };
    });
    
    // Calculate editable row indices in the filtered array
    const editableRowIndices = [];
    rowsNeedingEdit.forEach((row, idx) => {
      if (row._needsEdit) {
        editableRowIndices.push(idx);
      }
    });
    
    repairFileObjs.push({
      name: `${selectedFile || 'table'}_partial_repair_1_${Date.now()}.csv`,
      rows: rowsNeedingEdit,
      columns: Object.keys(tableData[0] || {}),
      types: confirmedTypes, // Include the confirmed types
      description: `Partial Repair 1: Remove first duplicate and empty rows, edit type violations (${rowsNeedingEdit.length} rows, ${rowsNeedingEdit.filter(r => r._needsEdit).length} need editing)`,
      isPartialRepair: true,
      editableRows: editableRowIndices
    });

    // Partial Repair 2: Remove second duplicate and empty rows, keep type violations for editing
    const lastIndices = new Map();
    
    // Find last occurrence of each duplicate value
    tableData.forEach((row, idx) => {
      if (nullRowIndices.has(idx)) return;
      
      for (const col of new Set(duplicateViolations.map(v => v.col))) {
        const value = row[col];
        const key = `${col}:${value}`;
        lastIndices.set(key, idx);
      }
    });
    
    const partialRepair2 = tableData.filter((row, idx) => {
      // Keep rows with type violations for manual editing
      if (typeViolatedRows.has(idx)) return true;
      
      // Remove null/empty rows
      if (nullRowIndices.has(idx)) return false;
      
      // For duplicates, keep last occurrence
      for (const col of new Set(duplicateViolations.map(v => v.col))) {
        const value = row[col];
        const key = `${col}:${value}`;
        const lastIdx = lastIndices.get(key);
        
        if (idx !== lastIdx) {
          return false; // Skip earlier duplicates
        }
      }
      return true;
    });
    
    // Mark rows that need editing
    const rowsNeedingEdit2 = partialRepair2.map((row, idx) => {
      const originalIdx = tableData.indexOf(row);
      return {
        ...row,
        _needsEdit: typeViolatedRows.has(originalIdx),
        _violationReasons: typeViolations
          .filter(v => v.row - 1 === originalIdx)
          .map(v => `${v.col}: ${v.msg}`)
      };
    });
    
    // Calculate editable row indices in the filtered array
    const editableRowIndices2 = [];
    rowsNeedingEdit2.forEach((row, idx) => {
      if (row._needsEdit) {
        editableRowIndices2.push(idx);
      }
    });
    
    repairFileObjs.push({
      name: `${selectedFile || 'table'}_partial_repair_2_${Date.now()}.csv`,
      rows: rowsNeedingEdit2,
      columns: Object.keys(tableData[0] || {}),
      types: confirmedTypes, // Include the confirmed types
      description: `Partial Repair 2: Remove second duplicate and empty rows, edit type violations (${rowsNeedingEdit2.length} rows, ${rowsNeedingEdit2.filter(r => r._needsEdit).length} need editing)`,
      isPartialRepair: true,
      editableRows: editableRowIndices2
    });
  }

  // Partial Repair 3: Custom table for all violations
  const customRepairRows = tableData.map((row, idx) => ({
    ...row,
    _needsEdit: violations.some(v => v.row - 1 === idx),
    _violationReasons: violations
      .filter(v => v.row - 1 === idx)
      .map(v => `${v.col}: ${v.msg}`)
  }));
  
  // Calculate editable row indices for custom repair
  const editableRowIndices3 = [];
  customRepairRows.forEach((row, idx) => {
    if (row._needsEdit) {
      editableRowIndices3.push(idx);
    }
  });
  
  repairFileObjs.push({
    name: `${selectedFile || 'table'}_partial_repair_custom.csv`,
    rows: customRepairRows,
    columns: Object.keys(tableData[0] || {}),
    types: confirmedTypes, // Include the confirmed types
    description: `Partial Repair 3: Custom editing for all violations (${customRepairRows.length} rows, ${customRepairRows.filter(r => r._needsEdit).length} need editing)`,
    isPartialRepair: true,
    editableRows: editableRowIndices3
  });
  
  return repairFileObjs;
}

/**
 * Generate repair files for general violations (null, duplicate, etc.)
 * @param {Array} violations - Array of violation objects
 * @param {Array} tableData - Table data
 * @param {string} selectedFile - Selected file name
 * @returns {Array} - Array of repair file objects
 */
export function generateGeneralRepairs(violations, tableData, selectedFile) {
  if (violations.length === 0) return [];
  
  const repairFileObjs = [];
  
  // Group violations by type
  const violationsByType = violations.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = [];
    acc[v.type].push(v);
    return acc;
  }, {});
  // Get all violations we need to handle
  const nullViolations = violations.filter(v => v.msg.includes('Null/empty value'));
  const duplicateViolations = violations.filter(v => v.msg.includes('Duplicate value'));
  const nullViolatedCols = new Set(nullViolations.map(v => v.col));
  const duplicateViolatedCols = new Set(duplicateViolations.map(v => v.col));
  const duplicateRowIndices = new Set(duplicateViolations.map(v => v.row - 1));
  const nullRowIndices = new Set(nullViolations.map(v => v.row - 1));
  
  if (duplicateViolations.length > 0 || nullViolations.length > 0) {
    // If there are no duplicates, only generate one repair that removes null/empty rows
    if (duplicateViolations.length === 0 && nullViolations.length > 0) {
      // Only one repair needed: remove null/empty rows
      const repairRows = tableData.filter((row, idx) => !nullRowIndices.has(idx));
      
      repairFileObjs.push({
        name: `${selectedFile || 'table'}_repair_1_${Date.now()}.csv`,
        rows: repairRows,
        columns: Object.keys(tableData[0] || {}),
        description: `Repair 1: Remove empty rows (${repairRows.length} rows)`
      });
      
      return repairFileObjs;
    }
    
    // If there are duplicates, generate both repair strategies
    // First repair: Keep first duplicate and remove empty values
    const seenValues = new Map(); // Track first occurrence of each value per column
    const repairRows1 = tableData.filter((row, idx) => {
      // Skip null/empty rows
      if (nullRowIndices.has(idx)) return false;
      
      // For duplicate value checks, look at all violated columns
      for (const col of duplicateViolatedCols) {
        const value = row[col];
        const key = `${col}:${value}`;
        
        if (seenValues.has(key)) {
          // If we've seen this value before in this column, skip this row
          return false;
        }
        // Record the first occurrence of this value in this column
        seenValues.set(key, idx);
      }
      return true;
    });
    
    // Second repair: Keep last duplicate and remove empty values
    const lastIndices = new Map(); // Track last occurrence of each value per column
    
    // First pass: find last occurrence of each value in each column
    tableData.forEach((row, idx) => {
      // Skip rows that will be removed due to null violations
      if (nullRowIndices.has(idx)) return;
      
      for (const col of duplicateViolatedCols) {
        const value = row[col];
        const key = `${col}:${value}`;
        lastIndices.set(key, idx);
      }
    });
    
    // Second pass: keep only the last occurrence of each duplicate value
    const repairRows2 = tableData.filter((row, idx) => {
      // Skip null/empty rows
      if (nullRowIndices.has(idx)) return false;
      
      // For each duplicate column, check if this is the last occurrence
      for (const col of duplicateViolatedCols) {
        const value = row[col];
        const key = `${col}:${value}`;
        const lastIdx = lastIndices.get(key);
        
        // If this is not the last occurrence of this value in this column, filter it out
        if (idx !== lastIdx) {
          return false;
        }
      }
      
      return true;
    });
    
    // Check if both repairs are identical before adding them
    const areRepairsIdentical = repairRows1.length === repairRows2.length && 
      repairRows1.every((row1, idx) => {
        const row2 = repairRows2[idx];
        return Object.keys(row1).every(col => row1[col] === row2[col]);
      });
    
    repairFileObjs.push({
      name: `${selectedFile || 'table'}_repair_1_${Date.now()}.csv`,
      rows: repairRows1,
      columns: Object.keys(tableData[0] || {}),
      description: `Repair 1: Keep first duplicate and remove empty rows (${repairRows1.length} rows)`
    });

    // Only add second repair if it's different from the first
    if (!areRepairsIdentical) {
      repairFileObjs.push({
        name: `${selectedFile || 'table'}_repair_2_${Date.now()}.csv`,
        rows: repairRows2,
        columns: Object.keys(tableData[0] || {}),
        description: `Repair 2: Keep last duplicate and remove empty rows (${repairRows2.length} rows)`
      });
    }
  }
  
  return repairFileObjs;
}

/**
 * Add custom repair option to repair files
 * @param {Array} repairFileObjs - Existing repair files
 * @param {Array} tableData - Table data
 * @param {string} selectedFile - Selected file name
 * @returns {Array} - Updated repair files with custom option
 */
export function addCustomRepairOption(repairFileObjs, tableData, selectedFile) {
  repairFileObjs.push({
    name: `${selectedFile || 'table'}_repair_custom.csv`,
    rows: tableData.map(row => ({ ...row })),
    columns: Object.keys(tableData[0] || {}),
    description: 'Custom repair - Manual editing'
  });
  
  return repairFileObjs;
}
