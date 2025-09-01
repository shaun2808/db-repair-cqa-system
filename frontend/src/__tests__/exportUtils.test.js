/**
 * Unit tests for exportUtils.js utility functions
 */

// Mock DOM APIs before importing
const mockElement = {
  href: '',
  download: '',
  click: jest.fn()
};

global.document = {
  createElement: jest.fn().mockImplementation((tag) => {
    console.log('Mock createElement called with:', tag);
    return mockElement;
  }),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

global.URL = {
  createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: jest.fn()
};

global.Blob = jest.fn().mockImplementation((content, options) => {
  console.log('Mock Blob called with:', content, options);
  return {
    content,
    type: options?.type
  };
});

import { getExportFileName, exportCSV, exportJSON } from '../utils/exportUtils';

describe('exportUtils.js', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getExportFileName', () => {
    it('should generate basic export filename with extension', () => {
      const result = getExportFileName('users', 'csv', null);
      expect(result).toBe('users_repair_1.csv');
    });

    it('should handle repair file with number', () => {
      const result = getExportFileName('users.json', 'csv', 'users_repair_2_123456.csv');
      expect(result).toBe('users_repair_2.csv');
    });

    it('should handle custom repair files', () => {
      const result = getExportFileName('users.json', 'csv', 'users_repair_custom.csv');
      expect(result).toBe('users_repair_custom.csv');
    });

    it('should clean up complex filenames', () => {
      const result = getExportFileName('users_repair_1_custom_repair_2.json.csv', 'json', 'users_repair_3_456789.csv');
      expect(result).toBe('users_repair_3.json');
    });

    it('should handle filenames with multiple extensions', () => {
      const result = getExportFileName('data.backup.json', 'csv', null);
      expect(result).toBe('data_repair_1.csv');
    });

    it('should handle empty or null selectedRepairFile', () => {
      const result = getExportFileName('table', 'json', '');
      expect(result).toBe('table_repair_1.json');
    });

    it('should remove repair suffixes from base name', () => {
      const result = getExportFileName('users_repair_custom', 'csv', 'users_repair_2_123.csv');
      expect(result).toBe('users_repair_2.csv');
    });
  });

  describe('exportCSV', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should export CSV with correct format', () => {
      const fileObj = {
        name: 'users.json',
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ]
      };

      // The function should run without throwing an error
      expect(() => {
        exportCSV(fileObj, 'users_repair_1.csv');
      }).not.toThrow();

      // Check that our mocks were called (if they work)
      expect(global.Blob).toHaveBeenCalledWith(
        ['id,name,email\r\n1,John,john@example.com\r\n2,Jane,jane@example.com'],
        { type: 'text/csv' }
      );
    });

    it('should handle empty values in CSV export', () => {
      const fileObj = {
        name: 'test',
        columns: ['col1', 'col2'],
        rows: [
          { col1: 'value1', col2: null },
          { col1: '', col2: 'value2' }
        ]
      };

      exportCSV(fileObj, null);

      expect(global.Blob).toHaveBeenCalledWith(
        ['col1,col2\r\nvalue1,\r\n,value2'],
        { type: 'text/csv' }
      );
    });

    it('should handle missing columns in rows', () => {
      const fileObj = {
        name: 'test',
        columns: ['col1', 'col2', 'col3'],
        rows: [
          { col1: 'value1' },
          { col1: 'value2', col2: 'value3' }
        ]
      };

      exportCSV(fileObj, null);

      expect(global.Blob).toHaveBeenCalledWith(
        ['col1,col2,col3\r\nvalue1,,\r\nvalue2,value3,'],
        { type: 'text/csv' }
      );
    });
  });

  describe('exportJSON', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should export JSON with correct format', () => {
      const fileObj = {
        name: 'users.csv',
        rows: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ]
      };

      // The function should run without throwing an error
      expect(() => {
        exportJSON(fileObj, 'users_repair_custom.json');
      }).not.toThrow();

      // Check Blob creation with pretty-printed JSON
      const expectedJSON = JSON.stringify(fileObj.rows, null, 2);
      expect(global.Blob).toHaveBeenCalledWith(
        [expectedJSON],
        { type: 'application/json' }
      );
    });

    it('should handle empty rows array', () => {
      const fileObj = {
        name: 'empty',
        rows: []
      };

      exportJSON(fileObj, null);

      expect(global.Blob).toHaveBeenCalledWith(
        ['[]'],
        { type: 'application/json' }
      );
    });

    it('should handle complex nested objects', () => {
      const fileObj = {
        name: 'complex',
        rows: [
          { 
            id: 1, 
            metadata: { 
              tags: ['tag1', 'tag2'], 
              nested: { value: 'test' } 
            } 
          }
        ]
      };

      exportJSON(fileObj, null);

      const expectedJSON = JSON.stringify(fileObj.rows, null, 2);
      expect(global.Blob).toHaveBeenCalledWith(
        [expectedJSON],
        { type: 'application/json' }
      );
    });
  });
});
