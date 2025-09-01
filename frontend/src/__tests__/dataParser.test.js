/**
 * Unit tests for dataParser.js utility functions
 */

import { parseCSV, parseJSON, detectTypes, normalizeType } from '../utils/dataParser';

// Mock the typeDetection module
jest.mock('../utils/typeDetection', () => ({
  detectColumnType: jest.fn()
}));

import { detectColumnType } from '../utils/typeDetection';

describe('dataParser.js', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    detectColumnType.mockReturnValue('TEXT');
  });

  describe('parseCSV', () => {
    it('should parse simple CSV with comma delimiter', () => {
      const csvText = 'name,age,email\nJohn,25,john@example.com\nJane,30,jane@example.com';
      const result = parseCSV(csvText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
      expect(result.rows).toEqual([
        { name: 'John', age: '25', email: 'john@example.com' },
        { name: 'Jane', age: '30', email: 'jane@example.com' }
      ]);
    });

    it('should parse CSV with tab delimiter', () => {
      const csvText = 'name\tage\temail\nJohn\t25\tjohn@example.com\nJane\t30\tjane@example.com';
      const result = parseCSV(csvText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
      expect(result.rows).toEqual([
        { name: 'John', age: '25', email: 'john@example.com' },
        { name: 'Jane', age: '30', email: 'jane@example.com' }
      ]);
    });

    it('should handle empty CSV', () => {
      const result = parseCSV('');
      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('should handle CSV with only headers', () => {
      const csvText = 'name,age,email';
      const result = parseCSV(csvText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
      expect(result.rows).toEqual([]);
    });

    it('should handle CSV with missing values', () => {
      const csvText = 'name,age,email\nJohn,,john@example.com\n,30,';
      const result = parseCSV(csvText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
      expect(result.rows).toEqual([
        { name: 'John', age: '', email: 'john@example.com' },
        { name: '', age: '30', email: '' }
      ]);
    });

    it('should trim whitespace from headers', () => {
      const csvText = ' name , age , email \nJohn,25,john@example.com';
      const result = parseCSV(csvText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
    });

    it('should filter out empty lines', () => {
      const csvText = 'name,age,email\n\nJohn,25,john@example.com\n\nJane,30,jane@example.com\n';
      const result = parseCSV(csvText);
      
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON array', () => {
      const jsonText = JSON.stringify([
        { name: 'John', age: 25, email: 'john@example.com' },
        { name: 'Jane', age: 30, email: 'jane@example.com' }
      ]);
      
      detectColumnType.mockReturnValue('TEXT');
      const result = parseJSON(jsonText);
      
      expect(result.columns).toEqual(['name', 'age', 'email']);
      expect(result.rows).toEqual([
        { name: 'John', age: 25, email: 'john@example.com' },
        { name: 'Jane', age: 30, email: 'jane@example.com' }
      ]);
      expect(result.types).toEqual(['TEXT', 'TEXT', 'TEXT']);
    });

    it('should handle objects with different keys', () => {
      const jsonText = JSON.stringify([
        { name: 'John', age: 25 },
        { name: 'Jane', email: 'jane@example.com' },
        { age: 30, phone: '123-456-7890' }
      ]);
      
      const result = parseJSON(jsonText);
      
      expect(result.columns).toEqual(expect.arrayContaining(['name', 'age', 'email', 'phone']));
      expect(result.rows[0]).toEqual({ name: 'John', age: 25, email: '', phone: '' });
      expect(result.rows[1]).toEqual({ name: 'Jane', age: '', email: 'jane@example.com', phone: '' });
      expect(result.rows[2]).toEqual({ name: '', age: 30, email: '', phone: '123-456-7890' });
    });

    it('should handle invalid JSON', () => {
      const result = parseJSON('invalid json');
      
      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = parseJSON('[]');
      
      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('should handle non-array JSON', () => {
      const result = parseJSON('{"name": "John"}');
      
      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('should handle array with non-object elements', () => {
      const result = parseJSON('["string", 123, true]');
      
      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('should call detectColumnType for each column', () => {
      const jsonText = JSON.stringify([
        { name: 'John', age: 25 },
        { name: 'Jane', age: 30 }
      ]);
      
      parseJSON(jsonText);
      
      expect(detectColumnType).toHaveBeenCalledTimes(2); // For 'name' and 'age' columns
      expect(detectColumnType).toHaveBeenCalledWith(['John', 'Jane']);
      expect(detectColumnType).toHaveBeenCalledWith([25, 30]);
    });
  });

  describe('detectTypes (legacy)', () => {
    it('should detect number type for numeric columns', () => {
      const rows = [
        { age: '25', score: '95.5' },
        { age: '30', score: '87.2' }
      ];
      const columns = ['age', 'score'];
      
      const result = detectTypes(rows, columns);
      
      expect(result).toEqual(['number', 'number']);
    });

    it('should detect string type for non-numeric columns', () => {
      const rows = [
        { name: 'John', city: 'New York' },
        { name: 'Jane', city: 'Los Angeles' }
      ];
      const columns = ['name', 'city'];
      
      const result = detectTypes(rows, columns);
      
      expect(result).toEqual(['string', 'string']);
    });

    it('should detect string type for mixed columns', () => {
      const rows = [
        { id: '1', name: 'John' },
        { id: 'abc', name: 'Jane' }
      ];
      const columns = ['id', 'name'];
      
      const result = detectTypes(rows, columns);
      
      expect(result).toEqual(['string', 'string']);
    });

    it('should handle empty values', () => {
      const rows = [
        { age: '25', name: '' },
        { age: '', name: 'Jane' }
      ];
      const columns = ['age', 'name'];
      
      const result = detectTypes(rows, columns);
      
      expect(result).toEqual(['string', 'string']);
    });
  });

  describe('normalizeType', () => {
    it('should normalize string types to VARCHAR', () => {
      expect(normalizeType('STRING')).toBe('VARCHAR');
      expect(normalizeType('TEXT')).toBe('VARCHAR');
      expect(normalizeType('string')).toBe('VARCHAR');
      expect(normalizeType('text')).toBe('VARCHAR');
    });

    it('should normalize number types to INTEGER', () => {
      expect(normalizeType('NUMBER')).toBe('INTEGER');
      expect(normalizeType('INT')).toBe('INTEGER');
      expect(normalizeType('number')).toBe('INTEGER');
      expect(normalizeType('int')).toBe('INTEGER');
    });

    it('should normalize float types to DECIMAL', () => {
      expect(normalizeType('FLOAT')).toBe('DECIMAL');
      expect(normalizeType('DOUBLE')).toBe('DECIMAL');
      expect(normalizeType('float')).toBe('DECIMAL');
      expect(normalizeType('double')).toBe('DECIMAL');
    });

    it('should return unknown types as-is', () => {
      expect(normalizeType('BOOLEAN')).toBe('BOOLEAN');
      expect(normalizeType('DATE')).toBe('DATE');
      expect(normalizeType('CUSTOM_TYPE')).toBe('CUSTOM_TYPE');
    });

    it('should handle case insensitive input', () => {
      expect(normalizeType('String')).toBe('VARCHAR');
      expect(normalizeType('Number')).toBe('INTEGER');
      expect(normalizeType('Float')).toBe('DECIMAL');
    });
  });
});
