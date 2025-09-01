/**
 * Unit tests for repairGenerator.js utility functions
 */

import { generateGeneralRepairs, generatePartialRepairs, generatePrimaryKeyRepairs } from '../utils/repairGenerator';

describe('repairGenerator.js', () => {
  
  describe('generateGeneralRepairs', () => {
    const mockColumns = ['id', 'name', 'email', 'age'];
    
    it('should generate repairs for violations', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 1, name: 'Jane', email: 'jane@example.com', age: 30 }, // Duplicate ID
        { id: 3, name: 'Bob', email: 'bob@example.com', age: 35 }
      ];
      const violations = [
        { type: 'PRIMARY KEY', row: 1, col: 'id', value: 1, msg: 'Duplicate value' },
        { type: 'PRIMARY KEY', row: 2, col: 'id', value: 1, msg: 'Duplicate value' }
      ];

      const repairs = generateGeneralRepairs(violations, data, 'test.csv');

      expect(repairs).toHaveLength(2); // Function generates multiple repair options
      expect(repairs[0].description).toContain('Repair');
      expect(repairs[0].rows).toHaveLength(2); // Two rows remain after deleting one duplicate
    });

    it('should generate partial repairs for type violations', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: null, email: 'jane@example.com', age: 'invalid' }, // Type violation
        { id: 3, name: 'Bob', email: null, age: 35 }
      ];
      const violations = [
        { type: 'NOT NULL', row: 2, col: 'name', value: null, msg: 'Null/empty value' },
        { type: 'TYPE MISMATCH', row: 2, col: 'age', value: 'invalid', msg: 'Type mismatch: expected INTEGER, got "invalid"' },
        { type: 'NOT NULL', row: 3, col: 'email', value: null, msg: 'Null/empty value' }
      ];

      const repairs = generatePartialRepairs(violations, data, 'test.csv', ['INTEGER', 'TEXT', 'TEXT', 'INTEGER']);

      expect(repairs.length).toBeGreaterThan(0);
      expect(repairs[0].description).toContain('Partial');
    });

    it('should handle empty violations array', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 30 }
      ];
      const violations = [];

      const repairs = generateGeneralRepairs(violations, data, 'test.csv');

      expect(repairs).toEqual([]);
    });

    it('should handle empty data array', () => {
      const data = [];
      const violations = [];

      const repairs = generateGeneralRepairs(violations, data, 'test.csv');

      expect(repairs).toEqual([]);
    });

    it('should handle basic functionality tests', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 }
      ];
      const violations = [
        { type: 'NOT NULL', row: 1, col: 'name', value: null, msg: 'Null value' }
      ];

      const repairs = generatePartialRepairs(violations, data, 'test.csv', ['INTEGER', 'TEXT', 'TEXT', 'INTEGER']);
      
      expect(Array.isArray(repairs)).toBe(true);
    });
  });
});
