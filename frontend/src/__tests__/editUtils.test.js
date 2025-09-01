/**
 * Unit tests for editUtils.js utility functions
 */

import { 
  saveToBackend, 
  validateEntry, 
  updateViolationsAfterDelete, 
  isCustomRepair, 
  calculateViolationPositions 
} from '../utils/editUtils';

// Mock fetch globally
global.fetch = jest.fn();

describe('editUtils.js', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('saveToBackend', () => {
    it('should successfully save repair file to backend', async () => {
      const mockRepairFile = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ]
      };
      const selectedFile = 'users.csv';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await saveToBackend(mockRepairFile, selectedFile);

      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'users.csv',
          columns: mockRepairFile.columns,
          rows: mockRepairFile.rows
        })
      });
      expect(result).toEqual({ success: true });
    });

    it('should use default table name when selectedFile is not provided', async () => {
      const mockRepairFile = {
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'John' }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await saveToBackend(mockRepairFile);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            table: 'table',
            columns: mockRepairFile.columns,
            rows: mockRepairFile.rows
          })
        })
      );
    });

    it('should throw error when repairFileObj is null', async () => {
      await expect(saveToBackend(null, 'test.csv')).rejects.toThrow('No repair file to save');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error when backend response is not ok', async () => {
      const mockRepairFile = {
        columns: ['id'],
        rows: [{ id: 1 }]
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(saveToBackend(mockRepairFile, 'test.csv')).rejects.toThrow('Failed to save to backend');
    });

    it('should throw error when fetch fails', async () => {
      const mockRepairFile = {
        columns: ['id'],
        rows: [{ id: 1 }]
      };

      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(saveToBackend(mockRepairFile, 'test.csv')).rejects.toThrow('Error saving to backend: Network error');
    });
  });

  describe('validateEntry', () => {
    it('should validate valid numeric entry', () => {
      const newEntry = { id: '1', name: 'John', age: '25' };
      const columns = ['id', 'name', 'age'];
      const colTypes = ['number', 'string', 'number'];

      const result = validateEntry(newEntry, columns, colTypes);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect invalid numeric entry', () => {
      const newEntry = { id: '1', name: 'John', age: 'abc' };
      const columns = ['id', 'name', 'age'];
      const colTypes = ['number', 'string', 'number'];

      const result = validateEntry(newEntry, columns, colTypes);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Column 'age' must be a number.");
    });

    it('should validate string entries regardless of content', () => {
      const newEntry = { id: '1', name: 'John123', description: '' };
      const columns = ['id', 'name', 'description'];
      const colTypes = ['number', 'string', 'string'];

      const result = validateEntry(newEntry, columns, colTypes);

      expect(result.isValid).toBe(true);
    });

    it('should return error for first invalid column encountered', () => {
      const newEntry = { id: 'abc', name: 'John', age: 'def' };
      const columns = ['id', 'name', 'age'];
      const colTypes = ['number', 'string', 'number'];

      const result = validateEntry(newEntry, columns, colTypes);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Column 'id' must be a number.");
    });

    it('should handle empty columns and types arrays', () => {
      const newEntry = {};
      const columns = [];
      const colTypes = [];

      const result = validateEntry(newEntry, columns, colTypes);

      expect(result.isValid).toBe(true);
    });
  });

  describe('updateViolationsAfterDelete', () => {
    it('should remove violations for deleted row and adjust row numbers', () => {
      const checkResults = [
        { row: 1, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' },
        { row: 2, col: 'name', type: 'NOT NULL', msg: 'Null/empty value' },
        { row: 3, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' }
      ];
      const deleteIndex = 1; // Delete row 2 (0-based index 1)

      const result = updateViolationsAfterDelete(checkResults, deleteIndex);

      // Row 2 should be removed, and row 3 should become row 2
      expect(result).toEqual([
        { row: 1, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' }, // Row 1 stays
        { row: 2, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' } // Row 3 becomes row 2
      ]);
    });

    it('should update row numbers for violations after deleted row', () => {
      const checkResults = [
        { row: 1, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' },
        { row: 3, col: 'name', type: 'NOT NULL', msg: 'Null/empty value' },
        { row: 4, col: 'email', type: 'UNIQUE', msg: 'Duplicate value' }
      ];
      const deleteIndex = 0; // Delete row 1 (0-based index)

      const result = updateViolationsAfterDelete(checkResults, deleteIndex);

      expect(result).toEqual([
        { row: 2, col: 'name', type: 'NOT NULL', msg: 'Null/empty value' }, // Row 3 becomes row 2
        { row: 3, col: 'email', type: 'UNIQUE', msg: 'Duplicate value' } // Row 4 becomes row 3
      ]);
    });

    it('should handle empty violations array', () => {
      const result = updateViolationsAfterDelete([], 1);
      expect(result).toEqual([]);
    });

    it('should handle null violations array', () => {
      const result = updateViolationsAfterDelete(null, 1);
      expect(result).toEqual([]);
    });

    it('should not change violations before deleted row', () => {
      const checkResults = [
        { row: 1, col: 'id', type: 'PRIMARY KEY', msg: 'Duplicate value' },
        { row: 2, col: 'name', type: 'NOT NULL', msg: 'Null/empty value' }
      ];
      const deleteIndex = 2; // Delete row 3 (0-based index)

      const result = updateViolationsAfterDelete(checkResults, deleteIndex);

      expect(result).toEqual(checkResults); // No changes
    });
  });

  describe('isCustomRepair', () => {
    it('should return true for custom repair files', () => {
      const customRepairFile = { name: 'users_repair_custom.csv' };
      expect(isCustomRepair(customRepairFile)).toBe(true);
    });

    it('should return false for non-custom repair files', () => {
      const regularRepairFile = { name: 'users_repair_1.csv' };
      expect(isCustomRepair(regularRepairFile)).toBe(false);
    });

    it('should return false for original files', () => {
      const originalFile = { name: 'users.csv' };
      expect(isCustomRepair(originalFile)).toBe(false);
    });

    it('should handle null repair file object', () => {
      expect(isCustomRepair(null)).toBe(false);
    });

    it('should handle repair file object without name', () => {
      const repairFile = { rows: [], columns: [] };
      expect(isCustomRepair(repairFile)).toBe(false);
    });

    it('should handle empty name', () => {
      const repairFile = { name: '' };
      expect(isCustomRepair(repairFile)).toBe(false);
    });
  });

  describe('calculateViolationPositions', () => {
    it('should calculate unique violation columns and rows', () => {
      const tableViolations = [
        { row: 1, col: 'id' },
        { row: 1, col: 'name' },
        { row: 2, col: 'id' },
        { row: 3, col: 'email' },
        { row: 3, col: 'id' }
      ];

      const result = calculateViolationPositions(tableViolations);

      expect(result.violationCols.sort()).toEqual(['email', 'id', 'name']);
      expect(result.violationRows.sort()).toEqual([0, 1, 2]); // Convert to 0-based indices
    });

    it('should handle empty violations array', () => {
      const result = calculateViolationPositions([]);

      expect(result.violationCols).toEqual([]);
      expect(result.violationRows).toEqual([]);
    });

    it('should handle null violations', () => {
      const result = calculateViolationPositions(null);

      expect(result.violationCols).toEqual([]);
      expect(result.violationRows).toEqual([]);
    });

    it('should handle single violation', () => {
      const tableViolations = [{ row: 5, col: 'email' }];

      const result = calculateViolationPositions(tableViolations);

      expect(result.violationCols).toEqual(['email']);
      expect(result.violationRows).toEqual([4]); // Convert to 0-based index
    });

    it('should deduplicate identical violations', () => {
      const tableViolations = [
        { row: 2, col: 'id' },
        { row: 2, col: 'id' },
        { row: 2, col: 'id' }
      ];

      const result = calculateViolationPositions(tableViolations);

      expect(result.violationCols).toEqual(['id']);
      expect(result.violationRows).toEqual([1]); // Convert to 0-based index
    });
  });
});
