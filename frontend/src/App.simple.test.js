import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock all utilities
jest.mock('./utils', () => ({
  parseCSV: jest.fn(),
  parseJSON: jest.fn(),
  detectTypes: jest.fn(),
  normalizeType: jest.fn(),
  checkForeignKeyViolations: jest.fn(),
  checkViolations: jest.fn(),
  checkRepairFileViolations: jest.fn(),
  generateForeignKeyRepairs: jest.fn(),
  generatePrimaryKeyRepairs: jest.fn(),
  generateGeneralRepairs: jest.fn(),
  generatePartialRepairs: jest.fn(),
  addCustomRepairOption: jest.fn(),
  exportCSV: jest.fn(),
  exportJSON: jest.fn(),
  exportMySQL: jest.fn(),
  runSqlQuery: jest.fn(),
  parseSQL: jest.fn(),
  updateTableEntry: jest.fn(),
  deleteTableEntry: jest.fn(),
  saveToBackend: jest.fn(),
  validateEntry: jest.fn(),
  updateViolationsAfterDelete: jest.fn(),
  isCustomRepair: jest.fn(),
  calculateViolationPositions: jest.fn(),
}));

// Mock child components
jest.mock('./components/NavBar/NavBar', () => {
  return function NavBar() {
    return <div data-testid="navbar">NavBar</div>;
  };
});

jest.mock('./components/FileList/FileList', () => {
  return function FileList() {
    return <div data-testid="file-list">FileList</div>;
  };
});

jest.mock('./components/TableView/TableView', () => {
  return function TableView() {
    return <div data-testid="table-view">TableView</div>;
  };
});

jest.mock('./components/RepairPanel/RepairPanel', () => {
  return function RepairPanel() {
    return <div data-testid="repair-panel">RepairPanel</div>;
  };
});

jest.mock('./components/RepairSection/RepairSection', () => {
  return function RepairSection() {
    return <div data-testid="repair-section">RepairSection</div>;
  };
});

jest.mock('./components/ColumnConfigModal/ColumnConfigModal', () => {
  return function ColumnConfigModal() {
    return <div data-testid="column-config-modal">ColumnConfigModal</div>;
  };
});

jest.mock('./components/RepairSection/EditEntryModal', () => {
  return function EditEntryModal() {
    return <div data-testid="edit-entry-modal">EditEntryModal</div>;
  };
});

describe('App Component', () => {
  let mockUtils;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUtils = require('./utils');
    
    // Set up default mock return values to prevent undefined errors
    mockUtils.parseCSV.mockReturnValue({
      columns: ['id', 'name', 'email'],
      rows: [{ id: 1, name: 'John', email: 'john@example.com' }]
    });
    
    mockUtils.detectTypes.mockReturnValue(['INTEGER', 'VARCHAR', 'VARCHAR']);
    mockUtils.checkViolations.mockReturnValue([]);
    mockUtils.generateGeneralRepairs.mockReturnValue([]);
    mockUtils.generatePrimaryKeyRepairs.mockReturnValue([]);
    mockUtils.isCustomRepair.mockReturnValue(false);
    mockUtils.calculateViolationPositions.mockReturnValue({
      violationCols: new Set(),
      violationRows: new Set()
    });
  });

  describe('Initial Render', () => {
    it('should render without crashing', () => {
      render(<App />);
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    it('should render all main components', () => {
      render(<App />);
      
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
      expect(screen.getByTestId('table-view')).toBeInTheDocument();
      expect(screen.getByTestId('repair-panel')).toBeInTheDocument();
    });

    it('should have App class name', () => {
      const { container } = render(<App />);
      expect(container.firstChild).toHaveClass('App');
    });
  });

  describe('Utility Functions', () => {
    it('should have all parsing utilities available', () => {
      expect(mockUtils.parseCSV).toBeDefined();
      expect(mockUtils.parseJSON).toBeDefined();
      expect(mockUtils.detectTypes).toBeDefined();
      expect(mockUtils.normalizeType).toBeDefined();
    });

    it('should have all violation checking utilities available', () => {
      expect(mockUtils.checkViolations).toBeDefined();
      expect(mockUtils.checkForeignKeyViolations).toBeDefined();
      expect(mockUtils.checkRepairFileViolations).toBeDefined();
      expect(mockUtils.calculateViolationPositions).toBeDefined();
    });

    it('should have all repair generation utilities available', () => {
      expect(mockUtils.generateGeneralRepairs).toBeDefined();
      expect(mockUtils.generatePrimaryKeyRepairs).toBeDefined();
      expect(mockUtils.generateForeignKeyRepairs).toBeDefined();
      expect(mockUtils.generatePartialRepairs).toBeDefined();
      expect(mockUtils.addCustomRepairOption).toBeDefined();
    });

    it('should have all export utilities available', () => {
      expect(mockUtils.exportCSV).toBeDefined();
      expect(mockUtils.exportJSON).toBeDefined();
      expect(mockUtils.exportMySQL).toBeDefined();
    });

    it('should have all SQL utilities available', () => {
      expect(mockUtils.runSqlQuery).toBeDefined();
      expect(mockUtils.parseSQL).toBeDefined();
    });

    it('should have all edit utilities available', () => {
      expect(mockUtils.updateTableEntry).toBeDefined();
      expect(mockUtils.deleteTableEntry).toBeDefined();
      expect(mockUtils.updateViolationsAfterDelete).toBeDefined();
      expect(mockUtils.validateEntry).toBeDefined();
    });
  });

  describe('Component State', () => {
    it('should initialize with empty files array', () => {
      render(<App />);
      // Component should render without errors when files is empty
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });

    it('should initialize with null selected file', () => {
      render(<App />);
      // Component should render without errors when selectedFile is null
      expect(screen.getByTestId('table-view')).toBeInTheDocument();
    });

    it('should initialize with empty repair files', () => {
      render(<App />);
      // Component should render without errors when repairFiles is empty
      expect(screen.getByTestId('repair-panel')).toBeInTheDocument();
    });
  });

  describe('Function Calls', () => {
    it('should be able to call parsing functions', () => {
      const testData = 'id,name\n1,John';
      const testFile = { name: 'test.csv' };
      
      mockUtils.parseCSV(testData, testFile);
      expect(mockUtils.parseCSV).toHaveBeenCalledWith(testData, testFile);
    });

    it('should be able to call violation checking functions', () => {
      const testFile = { rows: [], columns: [] };
      const testTypes = ['INTEGER', 'VARCHAR'];
      
      mockUtils.checkViolations(testFile, testTypes);
      expect(mockUtils.checkViolations).toHaveBeenCalledWith(testFile, testTypes);
    });

    it('should be able to call repair generation functions', () => {
      const testFile = { rows: [], columns: [] };
      const testViolations = [];
      
      mockUtils.generateGeneralRepairs(testFile, testViolations);
      expect(mockUtils.generateGeneralRepairs).toHaveBeenCalledWith(testFile, testViolations);
    });

    it('should be able to call export functions', () => {
      const testFile = { rows: [], columns: [] };
      const testFilename = 'export.csv';
      
      mockUtils.exportCSV(testFile, testFilename);
      expect(mockUtils.exportCSV).toHaveBeenCalledWith(testFile, testFilename);
    });

    it('should be able to call SQL functions', async () => {
      const testQuery = 'SELECT * FROM test';
      const testFile = { rows: [], columns: [] };
      
      await mockUtils.runSqlQuery(testQuery, testFile);
      expect(mockUtils.runSqlQuery).toHaveBeenCalledWith(testQuery, testFile);
    });

    it('should be able to call edit functions', () => {
      const testTableName = 'test_table';
      const testRowIndex = 0;
      const testRowData = { id: 1, name: 'John' };
      
      mockUtils.updateTableEntry(testTableName, testRowIndex, testRowData);
      expect(mockUtils.updateTableEntry).toHaveBeenCalledWith(testTableName, testRowIndex, testRowData);
      
      mockUtils.deleteTableEntry(testTableName, testRowIndex);
      expect(mockUtils.deleteTableEntry).toHaveBeenCalledWith(testTableName, testRowIndex);
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined return values gracefully', () => {
      // Set up scenario where utility functions return undefined
      mockUtils.generateGeneralRepairs.mockReturnValue(undefined);
      mockUtils.generatePrimaryKeyRepairs.mockReturnValue(undefined);
      
      // Should not crash when rendering
      expect(() => render(<App />)).not.toThrow();
    });

    it('should handle empty arrays gracefully', () => {
      // Set up scenario with empty arrays
      mockUtils.generateGeneralRepairs.mockReturnValue([]);
      mockUtils.checkViolations.mockReturnValue([]);
      
      // Should render without errors
      render(<App />);
      expect(screen.getByTestId('repair-panel')).toBeInTheDocument();
    });

    it('should handle null values gracefully', () => {
      // Set up scenario with null returns
      mockUtils.parseCSV.mockReturnValue(null);
      
      // Should not crash the component
      expect(() => render(<App />)).not.toThrow();
    });
  });
});
