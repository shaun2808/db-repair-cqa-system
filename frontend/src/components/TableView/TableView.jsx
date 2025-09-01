import React from 'react';
import './TableView.css';
import './ViolationDot.css';
import { FaTable, FaUpload } from 'react-icons/fa';

function TableView({
  data,
  onUpload,
  violations,
  onEditEntry,
  onDeleteEntry,
  editable,
  violationRows = [],
  showUndo,
  selectedRepairFile,
  onUndo,
  canUndo,
  isCustomRepair,
  fileName,
  repairFileObj
}) {
  // Helper function to get filename without extension
  const getFileNameWithoutExtension = (fullFileName) => {
    if (!fullFileName) return '';
    return fullFileName.replace(/\.[^/.]+$/, '');
  };

  // Helper function to check if filename is a repair file
  const isRepairFileName = (filename) => {
    if (!filename) return false;
    return filename.includes('_repair_');
  };

  // Helper function to check if this is a partial repair
  const isPartialRepair = (repairFileObj) => {
    return repairFileObj && repairFileObj.isPartialRepair;
  };

  // Helper function to check if a row needs editing in partial repair
  const needsEditing = (rowIndex) => {
    if (!isPartialRepair(repairFileObj)) return false;
    return repairFileObj.editableRows && repairFileObj.editableRows.includes(rowIndex);
  };

  // Defensive: if data is undefined, null, or not an array, show nothing
  if (!Array.isArray(data)) {
    return null;
  }

  // If data is empty, show the empty state
  if (data.length === 0) {
    return (
      <section className="table-view-new stylish empty">
        <div className="table-empty-content">
          <FaTable className="table-main-icon" />
          <p>No table data to display</p>
          <label className="upload-btn">
            <FaUpload style={{ marginRight: '0.5rem' }} /> Upload File
            <input type="file" style={{ display: 'none' }} onChange={onUpload} />
          </label>
        </div>
      </section>
    );
  }

  // Build a quick lookup for violations: {rowIdx: {colName: [violationObj, ...]}}
  // Also, for duplicate PK/UNIQUE, mark all rows with the same value as violating
  // BUT: Don't show violations for repair files since they should be clean
  const violationMap = {};
  const duplicateRows = new Set();
  let dupCols = new Set(); // Initialize outside conditional block
  const isCurrentFileRepair = isRepairFileName(fileName) || isRepairFileName(selectedRepairFile);
  
  if (Array.isArray(violations) && !isCurrentFileRepair) {
    // First, mark all directly violated rows
    violations.forEach(v => {
      if (!violationMap[v.row - 1]) violationMap[v.row - 1] = {};
      if (!violationMap[v.row - 1][v.col]) violationMap[v.row - 1][v.col] = [];
      violationMap[v.row - 1][v.col].push(v);
    });
    // For duplicate PK/UNIQUE, mark all rows with the same value as violating
    dupCols = new Set(violations.filter(v => v.msg && v.msg.toLowerCase().includes('duplicate')).map(v => v.col));
  }
  
  // For custom repair files, always check for duplicates in all columns to ensure edit/delete buttons appear
  if (isCustomRepair && Array.isArray(violations)) {
    dupCols = new Set(violations.filter(v => v.msg && v.msg.toLowerCase().includes('duplicate')).map(v => v.col));
    
    // Also mark rows with any type of violation for edit/delete buttons
    violations.forEach(v => {
      duplicateRows.add(v.row - 1); // Convert to 0-based index
    });
  }
  
  // Process duplicate columns to mark all duplicate rows
  if (dupCols.size > 0) {
    dupCols.forEach(col => {
      // Find all values that are duplicated in this column
      const valueCounts = {};
      data.forEach((row, idx) => {
        const val = row[col];
        if (val !== '' && val != null) {
          valueCounts[val] = (valueCounts[val] || []);
          valueCounts[val].push(idx);
        }
      });
      Object.values(valueCounts).forEach(indices => {
        if (indices.length > 1) {
          indices.forEach(i => duplicateRows.add(i));
        }
      });
    });
  }
  // Defensive: ensure data[0] is a valid object
  const columns = (data[0] && typeof data[0] === 'object') ? Object.keys(data[0]) : [];
  if (columns.length === 0) {
    return (
      <section className="table-view-new stylish empty">
        <div className="table-empty-content">
          <FaTable className="table-main-icon" />
          <p>No table data to display</p>
          <label className="upload-btn">
            <FaUpload style={{ marginRight: '0.5rem' }} /> Upload File
            <input type="file" style={{ display: 'none' }} onChange={onUpload} />
          </label>
        </div>
      </section>
    );
  }
  const duplicateViolationRows = Array.from(duplicateRows);

  // Determine header title and description
  const getHeaderInfo = () => {
    if (isPartialRepair(repairFileObj)) {
      return {
        title: 'Partial Repair',
        description: repairFileObj.description || 'Some rows require manual editing (highlighted in yellow)'
      };
    } else if (isCustomRepair) {
      return {
        title: 'Custom Repair',
        description: 'Manually edited repair with custom modifications'
      };
    } else {
      // Use the description from repairFileObj if available, otherwise extract repair number
      const description = repairFileObj && repairFileObj.description 
        ? repairFileObj.description 
        : 'Remove duplicate entries and null entries';
      
      // Extract repair number from filename
      if (selectedRepairFile.includes('repair_1')) {
        return {
          title: 'Repair 1',
          description: description
        };
      }
      if (selectedRepairFile.includes('repair_2')) {
        return {
          title: 'Repair 2', 
          description: description
        };
      }
      if (selectedRepairFile.includes('repair_3')) {
        return {
          title: 'Repair 3',
          description: description
        };
      }
      return {
        title: 'Repair 1',
        description: description
      };
    }
  };

  return (
    <section className="table-view-new stylish">
      {selectedRepairFile && (
        <div className="repair-header" style={{ backgroundColor: '#e3f0ff', padding: '0.7rem 1rem', borderBottom: '2px solid #0077c8' }}>
          <h2 style={{ margin: 0, color: '#0077c8', fontSize: '1.25rem', fontWeight: 700 }}>
            {getHeaderInfo().title}
          </h2>
          <p style={{ margin: '8px 0', color: '#666', fontSize: '14px' }}>
            {getHeaderInfo().description}
          </p>
        </div>
      )}
      {fileName && editable === undefined && !selectedRepairFile && (
        <div className="table-header">
          <h2>{getFileNameWithoutExtension(fileName)}</h2>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
              {(isCustomRepair || isPartialRepair(repairFileObj)) && (
                <th>
                  Edit
                  {showUndo && (
                    <button
                      onClick={onUndo}
                      disabled={!canUndo}
                      style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 6, background: !canUndo ? '#ccc' : '#ffb300', color: '#222', border: 'none', cursor: !canUndo ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}
                    >
                      Undo
                    </button>
                  )}
                </th>
              )}
              {/* Save button removed as requested */}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const needsEdit = needsEditing(idx);
              
              return (
                <tr key={idx}>
                  {columns.map((col, i) => {
                    const vList = violationMap[idx] && violationMap[idx][col];
                    let tooltip = '';
                    if (vList && vList.length) {
                      tooltip = vList.map(v => `${v.type}: ${v.msg}`).join('\n');
                    }
                    
                    // Add violation reasons for partial repairs
                    if (isPartialRepair(repairFileObj) && row._violationReasons && row._violationReasons.length > 0) {
                      const reasons = row._violationReasons.filter(reason => reason.startsWith(col + ':')).join('\n');
                      if (reasons) {
                        tooltip = tooltip ? tooltip + '\n' + reasons : reasons;
                      }
                    }
                    
                    let displayValue = row[col];
                    if (displayValue === null || displayValue === undefined) {
                      displayValue = '';
                    } else if (Array.isArray(displayValue) || (typeof displayValue === 'object' && displayValue !== null)) {
                      displayValue = JSON.stringify(displayValue);
                    }
                    
                    const cellStyle = needsEdit && row._violationReasons && 
                      row._violationReasons.some(reason => reason.startsWith(col + ':')) 
                      ? { backgroundColor: '#ffebcd', border: '2px solid #ffc107' } 
                      : {};
                    
                    return (
                      <td key={i} style={cellStyle}>
                        {displayValue}
                        {vList && vList.length > 0 && !isCurrentFileRepair && (
                          <span className="violation-dot" title={tooltip} />
                        )}
                        {isPartialRepair(repairFileObj) && tooltip && (
                          <span className="violation-dot" title={tooltip} style={{ backgroundColor: '#ffc107' }} />
                        )}
                      </td>
                    );
                  })}
                  {(isCustomRepair || isPartialRepair(repairFileObj)) ? (
                    (needsEdit || (Array.isArray(violationRows) && violationRows.includes(idx)) || duplicateViolationRows.includes(idx)) ? (
                      <td style={{ display: 'flex' }}>
                        <button 
                          className="edit-btn" 
                          onClick={() => onEditEntry(row)}
                          style={{ 
                            padding: '2px 10px', 
                            borderRadius: 6, 
                            background: '#00c3ff', 
                            color: '#fff', 
                            border: 'none', 
                            cursor: 'pointer' 
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          className="delete-btn" 
                          onClick={() => onDeleteEntry(row)}
                          style={{ 
                            padding: '2px 10px', 
                            marginLeft: 3, 
                            borderRadius: 6, 
                            background: '#ff3b3b', 
                            color: '#fff', 
                            border: 'none', 
                            cursor: 'pointer' 
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    ) : <td></td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TableView;