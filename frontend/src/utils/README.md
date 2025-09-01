# Utility Functions Documentation

This folder contains utility functions that were extracted from the main `App.js` component to improve code organization and maintainability.

## Structure

### `dataParser.js`
Contains functions for parsing CSV and JSON files:
- `parseCSV(text)` - Parses CSV text into columns and rows
- `parseJSON(text)` - Parses JSON text into columns, rows, and types
- `detectTypes(rows, columns)` - Simple type detection for legacy compatibility
- `normalizeType(type)` - Normalizes SQL type names

### `typeDetection.js`
Contains enhanced type detection functionality:
- `detectColumnType(values)` - Advanced type detection supporting TEXT, INTEGER, DECIMAL, DATE, TIME, DATETIME, BOOLEAN

### `violationChecker.js`
Contains functions for checking data violations:
- `checkForeignKeyViolations(foreignRows, primaryRows, fkCol, pkCol)` - Checks foreign key constraint violations
- `checkViolations(tableData, confirmedConstraints, fileTables, foreignKeyConfig)` - Checks general data violations
- `checkRepairFileViolations(repairFile, confirmedConstraints)` - Checks violations in repair files

### `repairGenerator.js`
Contains functions for generating repair files:
- `generateForeignKeyRepairs(foreignKeyConfig, fileTables, confirmedConstraints)` - Generates repairs for foreign key violations
- `generatePrimaryKeyRepairs(tableData, confirmedConstraints, selectedFile)` - Generates repairs for primary key violations
- `generateGeneralRepairs(violations, tableData, selectedFile)` - Generates repairs for general violations
- `addCustomRepairOption(repairFileObjs, tableData, selectedFile)` - Adds custom repair option

### `exportUtils.js`
Contains functions for exporting data:
- `getExportFileName(baseName, ext, selectedRepairFile)` - Generates export filename
- `exportCSV(fileObj, selectedRepairFile)` - Exports data as CSV
- `exportJSON(fileObj, selectedRepairFile)` - Exports data as JSON
- `exportMySQL(fileObj, selectedFile, confirmedConstraints, selectedRepairFile)` - Exports data as MySQL SQL

### `sqlUtils.js`
Contains functions for SQL query handling:
- `runSqlQuery(sqlQuery, repairFileObj, selectedRepairFile, selectedFile, fileTables, confirmedTypes, confirmedConstraints, foreignKeyConfig)` - Runs SQL queries on temporary tables

### `editUtils.js`
Contains functions for editing functionality:
- `saveToBackend(repairFileObj, selectedFile)` - Saves data to backend
- `validateEntry(newEntry, columns, colTypes)` - Validates entry data
- `updateViolationsAfterDelete(checkResults, deleteIndex)` - Updates violations after deletion
- `isCustomRepair(repairFileObj)` - Checks if repair is custom
- `calculateViolationPositions(tableViolations)` - Calculates violation positions

### `index.js`
Central export file that re-exports all utility functions for easier importing.

## Usage

Import utilities directly from the utils folder:

```javascript
import {
  parseCSV,
  checkViolations,
  generateRepairs,
  exportCSV
} from './utils';
```

## Benefits of This Structure

1. **Separation of Concerns**: Each file has a specific responsibility
2. **Maintainability**: Easier to find and modify specific functionality
3. **Reusability**: Functions can be easily reused in other components
4. **Testing**: Individual functions can be unit tested in isolation
5. **Code Organization**: Main component focuses on UI logic, utilities handle data processing
