// Utilities for exporting data in various formats

//Generate export filename with proper naming conventions
export function getExportFileName(baseName, ext, selectedRepairFile) {
  // Remove all extensions and any _repair_X or _repair_custom suffixes
  let name = baseName
    .replace(/(_custom_repair_\d+(_\d+)?)/g, '')
    .replace(/(_repair_custom)/g, '')
    .replace(/(_repair_\d+(_\d+)?)/g, '')
    .replace(/\.[^.]+/g, '');
    
  // If custom repair, use _repair_custom
  if (selectedRepairFile && selectedRepairFile.includes('_repair_custom')) {
    return `${name}_repair_custom.${ext}`;
  }
  
  // Find repair number if present in selectedRepairFile
  let repairNum = 1;
  const match = selectedRepairFile && selectedRepairFile.match(/_repair_(\d+)/);
  if (match) repairNum = match[1];
  
  return `${name}_repair_${repairNum}.${ext}`;
}

//Export data as CSV file
export function exportCSV(fileObj, selectedRepairFile) {
  const { columns, rows, name } = fileObj;
  const csv = [columns.join(',')].concat(
    rows.map(row => columns.map(col => (row[col] ?? '')).join(','))
  ).join('\r\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getExportFileName(name, 'csv', selectedRepairFile);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data as JSON file
 * @param {Object} fileObj - File object with rows and name
 * @param {string} selectedRepairFile - Selected repair file name
 */
export function exportJSON(fileObj, selectedRepairFile) {
  const { rows, name } = fileObj;
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getExportFileName(name, 'json', selectedRepairFile);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data as MySQL SQL file
 * @param {Object} fileObj - File object with columns, rows, and name
 * @param {string} selectedFile - Selected file name
 * @param {Array} confirmedConstraints - Array of constraint arrays
 * @param {string} selectedRepairFile - Selected repair file name
 */
export async function exportMySQL(fileObj, selectedFile, confirmedConstraints, selectedRepairFile) {
  try {
    const res = await fetch('http://localhost:5000/export-mysql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: (selectedFile || 'table'),
        columns: fileObj.columns,
        rows: fileObj.rows,
        constraints: confirmedConstraints
      })
    });
    
    if (!res.ok) throw new Error('Failed to export to MySQL');
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName(fileObj.name, 'sql', selectedRepairFile);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error exporting to MySQL: ' + err.message);
  }
}
