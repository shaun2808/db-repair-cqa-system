import React, { useState, useRef } from 'react';
import RepairPanel from './components/RepairPanel/RepairPanel';
import ColumnConfigModal from './components/ColumnConfigModal/ColumnConfigModal';
import RepairSection from './components/RepairSection/RepairSection';
import EditEntryModal from './components/RepairSection/EditEntryModal';
import './App.css';
import NavBar from './components/NavBar/NavBar';
import FileList from './components/FileList/FileList';
import TableView from './components/TableView/TableView';

// Import utility functions
import {
  parseCSV,
  parseJSON,
  detectTypes,
  normalizeType,
  checkForeignKeyViolations,
  checkViolations,
  checkRepairFileViolations,
  generateForeignKeyRepairs,
  generatePrimaryKeyRepairs,
  generateGeneralRepairs,
  generatePartialRepairs,
  addCustomRepairOption,
  exportCSV,
  exportJSON,
  exportMySQL,
  runSqlQuery,
  saveToBackend,
  validateEntry,
  updateViolationsAfterDelete,
  isCustomRepair as checkIsCustomRepair,
  calculateViolationPositions
} from './utils';

function App() {
  // --- State and ref hooks (must be at the very top) ---
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlError, setSqlError] = useState('');
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [files, setFiles] = useState([]); // list of file names
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTables, setFileTables] = useState({}); // {fileName: {rows, columns}}
  const [tableData, setTableData] = useState([]); // current table data for selected file
  const [repairFiles, setRepairFiles] = useState([]); // [{name, rows, columns}]
  const [selectedRepairFile, setSelectedRepairFile] = useState(null);
  const [editModal, setEditModal] = useState({ show: false, entry: null, columns: [] });
  const [repairTriggered, setRepairTriggered] = useState(false);
  const [repairCheckMode, setRepairCheckMode] = useState(false); // NEW: toggles check mode after repair
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumns, setModalColumns] = useState([]);
  const [modalTypes, setModalTypes] = useState([]);
  const [modalConstraints, setModalConstraints] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const customUndoStack = useRef([]);
  const [confirmedConstraints, setConfirmedConstraints] = useState([]);
  const [confirmedTypes, setConfirmedTypes] = useState([]);
  const [checkResults, setCheckResults] = useState(null);
  
  // Wrap setCheckResults to add debugging
  const setCheckResultsWithDebug = (violations) => {
    setCheckResults(violations);
  };
  const repairFileObj = repairFiles.find(f => f.name === selectedRepairFile);

  // Foreign key workflow state
  const [foreignKeyConfig, setForeignKeyConfig] = useState(null); // { primaryFile, fkCol, referencedFile }

  // --- Handler and helper function definitions ---
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let columns = [], rows = [];
      if (ext === 'json') {
        ({ columns, rows } = parseJSON(text));
      } else {
        ({ columns, rows } = parseCSV(text));
      }
      if (!columns.length) return;
      setModalColumns(columns);
      setModalTypes(detectTypes(rows, columns));
      setModalConstraints(columns.map(() => []));
      setPendingRows(rows);
      setPendingFile(file.name);
      setModalOpen(true);
      // If foreign key config is set and this is the referenced table, just set the config; do not check violations yet
      if (foreignKeyConfig && foreignKeyConfig.referencedFile === undefined) {
        setForeignKeyConfig((prev) => ({ ...prev, referencedFile: file.name }));
      }
    };
    reader.readAsText(file);
  };

  const setTypeAt = (idx, val) => {
    setModalTypes(types => types.map((t, i) => i === idx ? val : t));
  };

  const handleModalConfirm = () => {
    // Store the table data along with its columns, rows, and types
    setFileTables(prev => ({ 
      ...prev, 
      [pendingFile]: { 
        rows: pendingRows, 
        columns: modalColumns,
        types: modalTypes 
      } 
    }));
    setFiles(flist => flist.includes(pendingFile) ? flist : [...flist, pendingFile]);
    setSelectedFile(pendingFile);
    setTableData(pendingRows);
    setConfirmedConstraints(modalConstraints.map(arr => [...arr]));
    setConfirmedTypes([...modalTypes]);
    
    // If this table has a foreign key column
    const fkIdx = modalConstraints.findIndex(arr => arr.includes('foreign'));
    const pkIdx = modalConstraints.findIndex(arr => arr.includes('primary'));

    if (fkIdx !== -1) {
      // This is the foreign table (orders)
      setForeignKeyConfig(prev => {
        if (!prev) {
          return {
            referencedFile: pendingFile,
            fkCol: modalColumns[fkIdx],
            primaryFile: null
          };
        }
        return { 
          ...prev, 
          referencedFile: pendingFile,
          fkCol: modalColumns[fkIdx]  // Make sure we store the foreign key column name
        };
      });
    } else if (pkIdx !== -1) {
      // This is the primary table (customers)
      setForeignKeyConfig(prev => {
        if (!prev) {
          return {
            primaryFile: pendingFile,
            fkCol: null,
            referencedFile: null
          };
        }
        return { ...prev, primaryFile: pendingFile };
      });
    }
    setModalOpen(false);
  };
  const handleModalCancel = () => setModalOpen(false);

  function checkViolationsLocal() {
    return checkViolations(tableData, confirmedConstraints, fileTables, foreignKeyConfig, confirmedTypes);
  }

  const handleCheckRepair = () => {
    if (repairTriggered && selectedRepairFile) {
      const repairFile = repairFiles.find(f => f.name === selectedRepairFile);
      if (repairFile) {
        // Only check violations for custom repair files and partial repair files
        // Non-custom repair files (repair strategies) should be clean by design
        if (selectedRepairFile.includes('_repair_custom') || selectedRepairFile.includes('_partial_repair_')) {
          const violations = checkRepairFileViolations(repairFile, confirmedConstraints, fileTables, foreignKeyConfig, confirmedTypes);
          setCheckResultsWithDebug(violations);
        } else {
          // For non-custom repair files, show no violations
          setCheckResultsWithDebug([]);
        }
        return;
      }
    }
    
    const violations = checkViolationsLocal();
    setCheckResultsWithDebug(violations);
  };

  const handleRepair = () => {
    // Handle foreign key violations
    if (foreignKeyConfig && foreignKeyConfig.primaryFile && foreignKeyConfig.fkCol && foreignKeyConfig.referencedFile) {
      const repairFileObjs = generateForeignKeyRepairs(foreignKeyConfig, fileTables, confirmedConstraints);
      
      if (repairFileObjs.length > 0) {
        setRepairFiles([]);
        setTimeout(() => {
          setRepairFiles(repairFileObjs);
          setSelectedRepairFile(repairFileObjs[0].name);
          setRepairTriggered(true);
          setRepairCheckMode(true);
          
          // Store original rows in undo stack for the custom repair option
          const foreignTable = fileTables[foreignKeyConfig.referencedFile];
          if (customUndoStack.current.length === 0 && foreignTable) {
            customUndoStack.current.push(JSON.parse(JSON.stringify(foreignTable.rows)));
          }

          setTimeout(() => {
            // For non-custom repair files, ensure no violations are shown
            if (selectedRepairFile && !selectedRepairFile.includes('_repair_custom') && !selectedRepairFile.includes('_partial_repair_')) {
              setCheckResultsWithDebug([]);
            } else {
              handleCheckRepair();
            }
          }, 0);
        });
      }
      return;
    }

    // Handle general violations
    let repairFileObjs = [];
    
    // Generate primary key repairs
    const pkRepairs = generatePrimaryKeyRepairs(tableData, confirmedConstraints, selectedFile);
    repairFileObjs.push(...pkRepairs);
    
    if (pkRepairs.length === 0) {
      // Generate partial repairs for violations that include type mismatches
      const violations = checkViolationsLocal();
      const partialRepairs = generatePartialRepairs(violations, tableData, selectedFile, confirmedTypes);
      
      if (partialRepairs.length > 0) {
        // Use partial repairs when type mismatches exist
        repairFileObjs.push(...partialRepairs);
      } else {
        // Fallback to general repairs when no type mismatches (only duplicates/nulls)
        const generalRepairs = generateGeneralRepairs(violations, tableData, selectedFile);
        repairFileObjs.push(...generalRepairs);
      }
    }
    
    if (repairFileObjs.length > 0) {
      // For partial repairs, don't add additional custom repair option since Partial Repair 3 is already custom
      // For general repairs, add the custom repair option
      const hasPartialRepairs = repairFileObjs.some(repair => repair.isPartialRepair);
      if (!hasPartialRepairs) {
        // Add custom repair option for general repairs
        repairFileObjs = addCustomRepairOption(repairFileObjs, tableData, selectedFile);
      }
      
      setRepairFiles(repairFileObjs);
      setSelectedRepairFile(repairFileObjs[0].name);
      setRepairTriggered(true);
      setRepairCheckMode(true);
      setTimeout(() => {
        // For non-custom repair files, ensure no violations are shown
        if (repairFileObjs[0] && !repairFileObjs[0].name.includes('_repair_custom') && !repairFileObjs[0].name.includes('_partial_repair_')) {
          setCheckResultsWithDebug([]);
        } else {
          handleCheckRepair();
        }
      }, 0);
    }
  };

  const handleClearViolations = () => {
    setCheckResultsWithDebug(null);
    setRepairCheckMode(false);
  };

  React.useEffect(() => {
    if (selectedFile && fileTables[selectedFile]) {
      setTableData(fileTables[selectedFile].rows);
    }
  }, [selectedFile, fileTables]);

  React.useEffect(() => {
    setSqlQuery('');
    // For non-custom repair files, ensure no violations are shown
    if (selectedRepairFile && !selectedRepairFile.includes('_repair_custom') && !selectedRepairFile.includes('_partial_repair_')) {
      setCheckResultsWithDebug([]);
    } else if (selectedRepairFile && (selectedRepairFile.includes('_repair_custom') || selectedRepairFile.includes('_partial_repair_'))) {
      // For custom repair files and partial repair files, trigger violation check
      const repairFile = repairFiles.find(f => f.name === selectedRepairFile);
      if (repairFile) {
        const violations = checkRepairFileViolations(repairFile, confirmedConstraints, fileTables, foreignKeyConfig, confirmedTypes);
        setCheckResultsWithDebug(violations);
      } else {
        setCheckResultsWithDebug(null);
      }
    } else {
      setCheckResultsWithDebug(null);
    }
  }, [selectedRepairFile, repairFiles, confirmedConstraints, fileTables, foreignKeyConfig, confirmedTypes]);

  const isCustomRepair = checkIsCustomRepair(repairFileObj);
  const showRepairTable = !!repairFileObj;
  
  // Determine which data to show in the table
  let tableDataToShow = tableData;
  let tableViolations = checkResults;
  
  if (showRepairTable) {
    // Show the repair file's data
    tableDataToShow = repairFileObj.rows;
    
    // Clean up internal metadata for display
    if (repairFileObj.isPartialRepair) {
      tableDataToShow = repairFileObj.rows.map(row => {
        const cleanRow = { ...row };
        delete cleanRow._needsEdit;
        delete cleanRow._violationReasons;
        return cleanRow;
      });
    }
    
    if (isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair)) {
      // For custom repair and partial repairs, show all violations
      tableViolations = checkResults;
    } else {
      // For regular repair files, don't show any violations since they should be clean
      tableViolations = [];
    }
  }

  // Calculate violation columns and rows
  const { violationCols, violationRows } = calculateViolationPositions(tableViolations);

  const handleEditEntry = (entry) => {
    if (!isCustomRepair && !(repairFileObj && repairFileObj.isPartialRepair)) return;
    setEditModal({ show: true, entry, columns: repairFileObj?.columns || [], violationCols });
  };
  const handleSaveEdit = (newEntry) => {
    const fileObj = repairFiles.find(f => f.name === selectedRepairFile);
    if (!fileObj) return;
    
    const validation = validateEntry(newEntry, fileObj.columns, confirmedTypes);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }
    
    if (isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair)) {
      const fileObj = repairFiles.find(f => f.name === selectedRepairFile);
      if (fileObj) customUndoStack.current.push(JSON.parse(JSON.stringify(fileObj.rows)));
    }
    
    // Find the index of the entry to update
    const entryIndex = fileObj.rows.findIndex(r => {
      // For partial repairs, we need to compare the core data, not the metadata
      if (repairFileObj && repairFileObj.isPartialRepair) {
        // Compare all the actual column values (excluding metadata)
        return fileObj.columns.every(col => r[col] === editModal.entry[col]);
      }
      // For regular custom repairs, use object reference
      return r === editModal.entry;
    });
    
    if (entryIndex === -1) {
      return;
    }
    
    // Preserve metadata for partial repairs
    let updatedEntry = { ...newEntry };
    if (repairFileObj && repairFileObj.isPartialRepair && editModal.entry._needsEdit !== undefined) {
      updatedEntry._needsEdit = editModal.entry._needsEdit;
      updatedEntry._violationReasons = editModal.entry._violationReasons;
    }
    
    setRepairFiles(prev => prev.map(f =>
      f.name === selectedRepairFile
        ? { 
            ...f, 
            rows: f.rows.map((r, idx) => idx === entryIndex ? updatedEntry : r)
          }
        : f
    ));
    setEditModal({ show: false, entry: null, columns: [] });
  };
  const handleCancelEdit = () => setEditModal({ show: false, entry: null, columns: [] });

  const handleDeleteEntry = (entry) => {
    if (!isCustomRepair && !(repairFileObj && repairFileObj.isPartialRepair)) return;
    const fileObj = repairFiles.find(f => f.name === selectedRepairFile);
    if (fileObj) customUndoStack.current.push(JSON.parse(JSON.stringify(fileObj.rows)));
    
    // Find the index of the entry to be deleted
    const deleteIndex = fileObj.rows.findIndex(r => {
      // For partial repairs, we need to compare the core data, not the metadata
      if (repairFileObj && repairFileObj.isPartialRepair) {
        // Compare all the actual column values (excluding metadata)
        return fileObj.columns.every(col => r[col] === entry[col]);
      }
      // For regular custom repairs, use object reference
      return r === entry;
    });
    
    if (deleteIndex === -1) {
      return;
    }
    
    // Update repair files first - remove by index
    setRepairFiles(prev => prev.map(f =>
      f.name === selectedRepairFile
        ? { ...f, rows: f.rows.filter((r, idx) => idx !== deleteIndex) }
        : f
    ));

    // After updating the data, trigger a fresh violation check for custom repair or partial repair
    setTimeout(() => {
      if (selectedRepairFile && (selectedRepairFile.includes('_repair_custom') || selectedRepairFile.includes('_partial_repair_'))) {
        const updatedRepairFile = repairFiles.find(f => f.name === selectedRepairFile);
        if (updatedRepairFile) {
          const violations = checkRepairFileViolations(
            { ...updatedRepairFile, rows: updatedRepairFile.rows.filter(r => r !== entry) },
            confirmedConstraints,
            fileTables,
            foreignKeyConfig,
            confirmedTypes
          );
          setCheckResultsWithDebug(violations);
        }
      }
    }, 0);
  };

  const handleUndoCustom = () => {
    if (!isCustomRepair && !(repairFileObj && repairFileObj.isPartialRepair)) return;
    if (customUndoStack.current.length === 0) return;
    const prevRows = customUndoStack.current.pop();
    setRepairFiles(prev => prev.map(f =>
      f.name === selectedRepairFile
        ? { ...f, rows: prevRows }
        : f
    ));
  };

  const handleSaveToBackend = async () => {
    if ((!isCustomRepair && !(repairFileObj && repairFileObj.isPartialRepair)) || !repairFileObj) return;
    
    try {
      // Filter out metadata fields before saving
      const cleanRows = repairFileObj.rows.map(row => {
        const { _needsEdit, _violationReasons, ...cleanRow } = row;
        return cleanRow;
      });
      
      const cleanRepairFileObj = {
        ...repairFileObj,
        rows: cleanRows
      };
      
      await saveToBackend(cleanRepairFileObj, selectedFile);
      alert('Table saved to database!');
    } catch (err) {
      alert(err.message);
    }
  };

  const [sqlLoading, setSqlLoading] = useState(false);
  const handleRunSqlQuery = async () => {
    setSqlError('');
    setSqlResult(null);
    if (!repairFileObj || !sqlQuery.trim()) return;
    
    setSqlLoading(true);
    try {
      const data = await runSqlQuery(
        sqlQuery,
        repairFileObj,
        selectedRepairFile,
        selectedFile,
        fileTables,
        confirmedTypes,
        confirmedConstraints,
        foreignKeyConfig
      );
      
      if (data.error) setSqlError(data.error);
      else {
        setSqlResult(data);
        setSqlModalOpen(true);
      }
    } catch (err) {
      setSqlError(err.message);
    } finally {
      setSqlLoading(false);
    }
  };
  // --- Export handlers ---
  const handleExport = async (type) => {
    if (!repairFileObj) return;
    if (type === 'csv') {
      exportCSV(repairFileObj, selectedRepairFile);
    } else if (type === 'json') {
      exportJSON(repairFileObj, selectedRepairFile);
    } else if (type === 'mysql') {
      exportMySQL(repairFileObj, selectedFile, confirmedConstraints, selectedRepairFile);
    }
  };

  // --- Export query result handlers ---
  const handleExportQueryResult = (format) => {
    if (!sqlResult || !sqlResult.columns || !sqlResult.rows) return;

    const timestamp = new Date().toISOString().split('T')[0];
    let filename, content, mimeType;

    switch (format) {
      case 'csv':
        filename = `query_result_${timestamp}.csv`;
        content = generateCSVContent(sqlResult);
        mimeType = 'text/csv';
        break;
      case 'json':
        filename = `query_result_${timestamp}.json`;
        content = JSON.stringify(sqlResult.rows, null, 2);
        mimeType = 'application/json';
        break;
      case 'sql':
        filename = `query_result_${timestamp}.sql`;
        content = generateSQLContent(sqlResult);
        mimeType = 'text/sql';
        break;
      default:
        return;
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper function to generate CSV content
  const generateCSVContent = (result) => {
    const { columns, rows } = result;
    const csvRows = [];
    
    // Add header row
    csvRows.push(columns.join(','));
    
    // Add data rows
    rows.forEach(row => {
      const csvRow = columns.map(col => {
        const value = row[col] ?? '';
        return String(value);
      }).join(',');
      csvRows.push(csvRow);
    });
    
    return csvRows.join('\n');
  };

  // Helper function to generate SQL content
  const generateSQLContent = (result) => {
    const { columns, rows } = result;
    
    if (rows.length === 0) {
      return '-- No data to export';
    }
    
    // Create a generic table name
    const tableName = 'query_result';
    
    let sql = `-- Query Result Export\n-- Generated on ${new Date().toISOString()}\n\n`;
    
    // Create table structure (basic types)
    sql += `CREATE TABLE ${tableName} (\n`;
    const columnDefs = columns.map(col => `  ${col} TEXT`).join(',\n');
    sql += columnDefs + '\n);\n\n';
    
    // Insert data
    rows.forEach(row => {
      const values = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          return 'NULL';
        }
        return `'${String(value).replace(/'/g, "''")}'`;
      }).join(', ');
      
      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
    });
    
    return sql;
  };

  // --- Export dropdown state ---
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [sqlExportDropdownOpen, setSqlExportDropdownOpen] = useState(false);

  return (
    <div className="App">
      <NavBar />
      <div className="main-content">
        <div className="filelist-col main-col">
          <FileList files={files} onSelect={setSelectedFile} selectedFile={selectedFile} onUpload={handleUpload} />
          {repairTriggered && repairFiles.length > 0 && (
            <RepairSection
              repairFiles={repairFiles}
              onSelect={setSelectedRepairFile}
              selectedFile={selectedRepairFile}
            />
          )}
        </div>
        <div className="tableview-col main-col">
          {(isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair)) && (
            <div style={{ marginBottom: 8, textAlign: 'right' }}>
              <button
                onClick={handleUndoCustom}
                disabled={customUndoStack.current.length === 0}
                style={{ padding: '2px 14px', borderRadius: 6, background: customUndoStack.current.length === 0 ? '#ccc' : '#ffb300', color: '#222', border: 'none', cursor: customUndoStack.current.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                Undo
              </button>
            </div>
          )}
          <TableView
            key={showRepairTable && foreignKeyConfig && foreignKeyConfig.primaryFile ? foreignKeyConfig.primaryFile : (showRepairTable ? selectedRepairFile : selectedFile)}
            data={tableDataToShow}
            onUpload={handleUpload}
            violations={tableViolations}
            onEditEntry={isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair) ? handleEditEntry : undefined}
            onDeleteEntry={isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair) ? handleDeleteEntry : undefined}
            editable={isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair)}
            isCustomRepair={isCustomRepair}
            violationCols={violationCols}
            violationRows={violationRows}
            showUndo={isCustomRepair || (repairFileObj && repairFileObj.isPartialRepair)}
            onUndo={handleUndoCustom}
            canUndo={customUndoStack.current.length > 0}
            onSave={isCustomRepair ? handleSaveToBackend : undefined}
            selectedRepairFile={selectedRepairFile}
            fileName={showRepairTable ? selectedRepairFile : selectedFile}
            repairFileObj={repairFileObj}
          />
        </div>
        <div className="repairpanel-col main-col">
          <RepairPanel
            checkDisabled={files.length === 0}
            onCheckRepair={handleCheckRepair}
            onRepair={handleRepair}
            checkResults={checkResults}
            onClearViolations={handleClearViolations}
            repairTriggered={repairTriggered}
            repairFileObj={repairFileObj}
            handleExport={handleExport}
          />
          {/* SQL Query UI: only show if a repair is created, selected, and has no violations */}
          {repairTriggered && repairFileObj && checkResults && checkResults.length === 0 && (
            <div style={{
              marginTop: 0,
              padding: 25,
              background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
              maxWidth: 600,
              fontFamily: 'inherit',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, color: 'white', letterSpacing: 0.5 }}>Run SQL Query</h3>
              <textarea
                value={sqlQuery}
                onChange={e => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM table WHERE ..."
                style={{
                  width: '100%',
                  padding: '14px 14px',
                  borderRadius: 8,
                  border: '1.5px solid #b0b8c9',
                  fontSize: 15,
                  background: '#f4f8fb',
                  color: '#1a2330',
                  outline: 'none',
                  transition: 'border 0.2s',
                  height: '150px',
                  minHeight: '48px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  marginBottom: 18,
                }}
                rows={5}
                onFocus={e => (e.target.style.border = '1.5px solid #0077c8')}
                onBlur={e => (e.target.style.border = '1.5px solid #b0b8c9')}
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
                <button
                  onClick={handleRunSqlQuery}
                  style={{
                    padding: '10px 36px',
                    borderRadius: 8,
                    background: 'linear-gradient(90deg, #00c3ff 0%, #0077c8 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 17,
                    cursor: sqlLoading ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px #cbe7ff',
                    letterSpacing: 0.5,
                    opacity: sqlLoading ? 0.7 : 1,
                    position: 'relative',
                  }}
                  disabled={sqlLoading}
                >
                  {sqlLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{
                        width: 22,
                        height: 22,
                        border: '3px solid #fff',
                        borderTop: '3px solid #00c3ff',
                        borderRadius: '50%',
                        marginRight: 10,
                        animation: 'spin 1s linear infinite',
                        display: 'inline-block',
                      }} />
                      <span>Running...</span>
                    </span>
                  ) : (
                    'Run'
                  )}
                </button>
              </div>
              {/* Spinner keyframes */}
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              {sqlError && <div style={{ color: '#d32f2f', marginTop: 10, fontWeight: 500, textAlign: 'center' }}>{sqlError}</div>}
            </div>
          )}
  {/* SQL Query Result Modal */}
  {sqlModalOpen && sqlResult && sqlResult.columns && sqlResult.rows && (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(30,40,60,0.45)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 8px 48px #2226',
        padding: 48,
        minWidth: 700,
        maxWidth: '98vw',
        maxHeight: '92vh',
        overflow: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={() => setSqlModalOpen(false)}
          style={{
            position: 'absolute',
            top: 18,
            right: 24,
            background: '#e3f0ff',
            color: '#0077c8',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 22,
            padding: '4px 18px',
            cursor: 'pointer',
            boxShadow: '0 1px 4px #e0e7ef',
          }}
          aria-label="Close"
        >
          ×
        </button>
        <h3 style={{ marginTop: 0, color: '#0077c8', marginBottom: 24, fontSize: 28 }}>SQL Query Result</h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #e0e7ef', fontSize: 18 }}>
            <thead>
              <tr style={{ background: '#e3f0ff' }}>
                {sqlResult.columns.map(col => (
                  <th key={col} style={{ borderBottom: '3px solid #b0b8c9', padding: '14px 10px', color: '#0077c8', fontWeight: 800, fontSize: 18 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sqlResult.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#f4f8fb' }}>
                  {sqlResult.columns.map(col => (
                    <td key={col} style={{ padding: '14px 10px', color: '#1a2330', fontSize: 18 }}>{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Export Dropdown Below Table */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: 24,
          paddingTop: 20,
          borderTop: '2px solid #0077c8',
          backgroundColor: '#f8fafc',
          padding: '20px',
          borderRadius: '0 0 18px 18px',
          marginLeft: '-48px',
          marginRight: '-48px',
          marginBottom: '-48px'
        }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSqlExportDropdownOpen(!sqlExportDropdownOpen)}
              onBlur={e => setTimeout(() => setSqlExportDropdownOpen(false), 150)}
              style={{
                background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 17,
                padding: '10px 55px',
                cursor: 'pointer',
                letterSpacing: '0.5px',
                outline: 'none',
                minWidth: '180px'
              }}
            >
              Export ▼
            </button>
            {sqlExportDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '44px',
                left: 0,
                background: '#fff',
                border: '1.5px solid #43e97b',
                borderRadius: 8,
                zIndex: 10,
                minWidth: '180px'
              }}>
                <div
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: '#1a2330',
                    fontWeight: 600,
                    borderBottom: '1px solid #e0f7ef',
                    background: 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseDown={e => { 
                    e.preventDefault(); 
                    handleExportQueryResult('csv'); 
                    setSqlExportDropdownOpen(false); 
                  }}
                  onMouseEnter={e => e.target.style.background = '#e0f7ef'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  CSV
                </div>
                <div
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: '#1a2330',
                    fontWeight: 600,
                    borderBottom: '1px solid #e0f7ef',
                    background: 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseDown={e => { 
                    e.preventDefault(); 
                    handleExportQueryResult('json'); 
                    setSqlExportDropdownOpen(false); 
                  }}
                  onMouseEnter={e => e.target.style.background = '#e0f7ef'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  JSON
                </div>
                <div
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: '#1a2330',
                    fontWeight: 600,
                    borderBottom: 'none',
                    background: 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseDown={e => { 
                    e.preventDefault(); 
                    handleExportQueryResult('sql'); 
                    setSqlExportDropdownOpen(false); 
                  }}
                  onMouseEnter={e => e.target.style.background = '#e0f7ef'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  .sql
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}
        </div>
      </div>
      <ColumnConfigModal
        columns={modalColumns}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        show={modalOpen}
        detectedTypes={modalTypes}
        setTypes={setTypeAt}
        constraints={modalConstraints}
        setConstraints={setModalConstraints}
      />
      <EditEntryModal
        show={editModal.show}
        entry={editModal.entry}
        columns={editModal.columns}
        violationCols={editModal.violationCols}
        types={confirmedTypes}
        constraints={confirmedConstraints}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
}

export default App;
