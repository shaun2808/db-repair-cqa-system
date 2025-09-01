// Utilities for SQL query handling

export async function runSqlQuery(
  sqlQuery,
  repairFileObj,
  selectedRepairFile,
  selectedFile,
  fileTables,
  confirmedTypes,
  confirmedConstraints,
  foreignKeyConfig
) {

  if (!repairFileObj || !sqlQuery.trim()) {
    throw new Error('Missing repair file or query');
  }

  try {
    // If this is a repair file, get the original table name
    const originalTableName = selectedRepairFile ? 
      selectedRepairFile.split('_repair_')[0] : 
      (selectedFile || 'table');
    
    // Prepare tables data
    const tables = {};
    
    // Get clean table names without extensions
    const currentTableName = originalTableName.split('.')[0];
    const primaryTableName = foreignKeyConfig?.primaryFile?.split('.')[0];
    
    // Add the current/repair table with its types and constraints
    tables[currentTableName] = {
      columns: repairFileObj.columns,
      rows: repairFileObj.rows,
      types: confirmedTypes, // Use the confirmed types directly
      constraints: confirmedConstraints
    };

    // If we have a foreign key relationship, add the related table
    if (foreignKeyConfig && foreignKeyConfig.primaryFile) {
      const primaryTable = fileTables[foreignKeyConfig.primaryFile];
      if (primaryTable) {
        tables[primaryTableName] = {
          columns: primaryTable.columns,
          rows: primaryTable.rows,
          types: primaryTable.types || confirmedTypes  // Use the primary table's actual types
        };
        
        // Determine the primary key column
        const primaryIdx = primaryTable.columns.findIndex((col, idx) => {
          const constraints = confirmedConstraints[idx] || [];
          return constraints.includes('primary');
        });
        foreignKeyConfig.primaryKeyColumn = primaryIdx !== -1 ? 
          primaryTable.columns[primaryIdx] : 
          primaryTable.columns[0];
      }
    }

    const payload = {
      query: sqlQuery,
      tables: tables,
      constraints: confirmedConstraints,
      foreignKeyConfig: foreignKeyConfig && foreignKeyConfig.primaryFile ? {
        primaryTable: primaryTableName,
        foreignTable: currentTableName,
        foreignKeyColumn: foreignKeyConfig.fkCol,
        primaryKeyColumn: foreignKeyConfig.primaryKeyColumn
      } : null
    };
    
    const res = await fetch('http://localhost:5000/query-temp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Query failed');
    
    const data = await res.json();
    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}
