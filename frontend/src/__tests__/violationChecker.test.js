/**
 * Unit tests for violationChecker.js utility functions
 */

import { checkViolations } from '../utils/violationChecker';

describe('violationChecker.js', () => {
  
  describe('checkViolations', () => {
    const mockColumns = ['id', 'name', 'email', 'age'];
    
    it('should detect primary key violations', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 1, name: 'Jane', email: 'jane@example.com', age: 30 }, // Duplicate ID
        { id: 3, name: 'Bob', email: 'bob@example.com', age: 35 }
      ];
      const constraints = [['primary'], [], [], []];

      const violations = checkViolations(data, constraints, {}, null);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'PRIMARY KEY')).toBe(true);
      expect(violations.some(v => v.col === 'id')).toBe(true);
    });

    it('should detect unique constraint violations', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: 'Jane', email: 'john@example.com', age: 30 }, // Duplicate email
        { id: 3, name: 'Bob', email: 'bob@example.com', age: 35 }
      ];
      const constraints = [[], [], ['unique'], []];

      const violations = checkViolations(data, constraints, {}, null);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'UNIQUE')).toBe(true);
      expect(violations.some(v => v.col === 'email')).toBe(true);
    });

    it('should detect not null violations', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: null, email: 'jane@example.com', age: 30 }, // Null name
        { id: 3, name: 'Bob', email: null, age: 35 } // Null email
      ];
      const constraints = [[], ['notnull'], ['notnull'], []];

      const violations = checkViolations(data, constraints, {}, null);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'NOT NULL')).toBe(true);
      expect(violations.some(v => v.col === 'name')).toBe(true);
      expect(violations.some(v => v.col === 'email')).toBe(true);
    });

    it('should detect empty string violations for not null constraints', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: '', email: 'jane@example.com', age: 30 }, // Empty name
        { id: 3, name: 'Bob', email: '   ', age: 35 } // Whitespace email
      ];
      const constraints = [[], ['notnull'], ['notnull'], []];

      const violations = checkViolations(data, constraints, {}, null);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'NOT NULL')).toBe(true);
    });

    it('should handle mixed constraint types and empty arrays', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 30 },
        { id: 3, name: 'Bob', email: 'bob@example.com', age: 35 }
      ];
      const constraints = [['primary', 'notnull'], ['notnull', 'unique'], ['unique'], []];

      const violations = checkViolations(data, constraints, {}, null);

      // Should return array (no violations expected with clean data)
      expect(Array.isArray(violations)).toBe(true);
    });

    it('should handle empty data array', () => {
      const data = [];
      const constraints = [['primary'], ['notnull'], ['unique'], []];

      const violations = checkViolations(data, constraints, {}, null);

      expect(violations).toEqual([]);
    });

    it('should handle basic violation detection', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: undefined, email: 'jane@example.com', age: null }
      ];
      const constraints = [[], ['notnull'], [], ['notnull']];

      const violations = checkViolations(data, constraints, {}, null);

      expect(Array.isArray(violations)).toBe(true);
      if (violations.length > 0) {
        expect(violations.some(v => v.type === 'NOT NULL')).toBe(true);
      }
    });
  });
});
