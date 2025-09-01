// Utilities for editing functionality

//Save entry to backend

export async function saveToBackend(repairFileObj, selectedFile) {
  if (!repairFileObj) {
    throw new Error('No repair file to save');
  }
  
  try {
    const payload = {
      table: (selectedFile || 'table'),
      columns: repairFileObj.columns,
      rows: repairFileObj.rows
    };

    
    const response = await fetch('http://localhost:5000/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error('Failed to save to backend');
    
    return { success: true };
  } catch (err) {
    throw new Error('Error saving to backend: ' + err.message);
  }
}

//Validate entry data before saving
export function validateEntry(newEntry, columns, colTypes) {
  for (let i = 0; i < columns.length; ++i) {
    const col = columns[i];
    const type = colTypes[i];
    const val = newEntry[col];
    
    if (type === 'number' && isNaN(val)) {
      return { 
        isValid: false, 
        error: `Column '${col}' must be a number.` 
      };
    }
  }
  
  return { isValid: true };
}

//Update violations after deleting an entry
export function updateViolationsAfterDelete(checkResults, deleteIndex) {
  if (!checkResults || checkResults.length === 0) return [];
  
  return checkResults.filter(violation => {
    const violationRow = violation.row - 1; // Convert to 0-based index
    return violationRow !== deleteIndex; // Remove violations for the deleted row
  }).map(violation => {
    const violationRow = violation.row - 1; // Convert to 0-based index
    if (violationRow > deleteIndex) {
      // If violation was after the deleted row, decrease its row number
      return { ...violation, row: violation.row - 1 };
    }
    return violation;
  });
}

//Check if repair is custom repair or partial repair (both are editable)
export function isCustomRepair(repairFileObj) {
  return !!(repairFileObj && repairFileObj.name && 
    (repairFileObj.name.includes('_repair_custom') || repairFileObj.name.includes('_partial_repair_custom')));
}

//Calculate violation columns and rows from violations
export function calculateViolationPositions(tableViolations) {
  let violationCols = [];
  let violationRows = [];
  
  if (tableViolations && tableViolations.length > 0) {
    violationCols = Array.from(new Set(tableViolations.map(v => v.col)));
    violationRows = Array.from(new Set(tableViolations.map(v => v.row - 1)));
  }
  
  return { violationCols, violationRows };
}
