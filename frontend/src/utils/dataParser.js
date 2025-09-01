// Utilities for parsing CSV and JSON files
import { detectColumnType } from './typeDetection.js';

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { columns: [], rows: [] };
  
  const header = lines[0];
  const delimiter = (header.match(/\t/g) || []).length > (header.match(/,/g) || []).length ? '\t' : ',';
  const columns = header.split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(delimiter);
    const obj = {};
    columns.forEach((col, i) => { obj[col] = vals[i] || ''; });
    return obj;
  });
  return { columns, rows };
}

//Parse JSON text into columns and rows
export function parseJSON(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || arr.length === 0 || typeof arr[0] !== 'object') {
      return { columns: [], rows: [], types: [] };
    }
    
    // Collect all unique keys from all objects
    const columnsSet = new Set();
    arr.forEach(obj => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => columnsSet.add(key));
      }
    });
    const columns = Array.from(columnsSet);
    const rows = arr.map(obj => {
      const row = {};
      columns.forEach(col => { row[col] = obj[col] ?? ''; });
      return row;
    });

    // Detect types for each column
    const types = columns.map(col => {
      const values = rows.map(row => row[col]);
      return detectColumnType(values);
    });

    return { columns, rows, types };
  } catch {
    return { columns: [], rows: [], types: [] };
  }
}


//Simple type detection for basic use (legacy compatibility)
export function detectTypes(rows, columns) {
  // Simple type detection: number if all values are numbers, else string
  return columns.map(col => {
    if (rows.every(row => !isNaN(row[col]) && row[col] !== '')) return 'number';
    return 'string';
  });
}

//Normalize SQL type to ensure consistent type names
export function normalizeType(type) {
  type = type.toUpperCase();
  switch (type) {
    case 'STRING':
    case 'TEXT':
      return 'VARCHAR';
    case 'NUMBER':
    case 'INT':
      return 'INTEGER';
    case 'FLOAT':
    case 'DOUBLE':
      return 'DECIMAL';
    default:
      return type;
  }
}
