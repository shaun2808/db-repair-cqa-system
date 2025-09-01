import React, { useState, useEffect } from 'react';
import './RepairSection.css';

function EditEntryModal({ show, entry, columns, violationCols = [], types = [], constraints = [], onSave, onCancel }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  
  // Update form data when entry prop changes
  useEffect(() => {
    if (entry) {
      setForm({ ...entry });
      setErrors({}); // Clear any existing errors when loading new entry
    }
  }, [entry]);
  
  if (!show) return null;

  // Helper to convert SQL data types to validation types
  function mapSqlTypeToValidationType(sqlType) {
    switch (sqlType?.toUpperCase()) {
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
        return 'integer';
      case 'FLOAT':
      case 'DOUBLE':
      case 'DECIMAL':
      case 'NUMERIC':
        return 'number';
      case 'BOOLEAN':
      case 'BOOL':
        return 'boolean';
      case 'DATE':
      case 'DATETIME':
      case 'TIMESTAMP':
        return 'date';
      case 'VARCHAR':
      case 'TEXT':
      case 'CHAR':
      case 'STRING':
      default:
        return 'string';
    }
  }

  // Helper to validate value by type
  function validateType(val, type) {
    if (!val || val.trim() === '') return true; // Empty values are handled by NOT NULL check
    
    const trimmedVal = val.trim();
    
    switch (type) {
      case 'number':
        return !isNaN(parseFloat(trimmedVal)) && isFinite(trimmedVal);
      case 'integer':
        // More strict integer validation
        const num = parseFloat(trimmedVal);
        // Check if it's a valid number, finite, integer, and doesn't contain non-numeric characters
        return !isNaN(num) && isFinite(num) && Number.isInteger(num) && /^-?\d+$/.test(trimmedVal);
      case 'boolean':
        return ['true', 'false', '1', '0', 'yes', 'no'].includes(trimmedVal.toLowerCase());
      case 'date':
        return !isNaN(Date.parse(trimmedVal));
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedVal);
      case 'string':
      case 'text':
      default:
        return true;
    }
  }

  // Helper to get appropriate input type for HTML input
  function getInputType(sqlType) {
    const validationType = mapSqlTypeToValidationType(sqlType);
    switch (validationType) {
      case 'number':
      case 'integer':
        return 'number';
      case 'date':
        return 'date';
      case 'boolean':
        return 'text'; // We'll use text with validation for boolean
      default:
        return 'text';
    }
  }

  // Helper to get placeholder text
  function getPlaceholder(sqlType, constraints) {
    const validationType = mapSqlTypeToValidationType(sqlType);
    const constraintText = constraints.includes('notnull') ? ' (required)' : '';
    switch (validationType) {
      case 'number':
        return `Enter a number (${sqlType})${constraintText}`;
      case 'integer':
        return `Enter an integer (${sqlType})${constraintText}`;
      case 'boolean':
        return `true/false, 1/0, yes/no (${sqlType})${constraintText}`;
      case 'date':
        return `YYYY-MM-DD (${sqlType})${constraintText}`;
      default:
        return `Enter ${sqlType.toLowerCase()} value${constraintText}`;
    }
  }

  function validateForm() {
    const newErrors = {};
    
    columns.forEach((col, idx) => {
      // Only validate editable fields if violationCols is specified
      if (violationCols.length > 0 && !violationCols.includes(col)) return;
      
      const value = form[col] || '';
      const sqlType = types[idx] || 'VARCHAR';
      const validationType = mapSqlTypeToValidationType(sqlType);
      const columnConstraints = constraints[idx] || [];
      
      // Check NOT NULL constraint
      if (columnConstraints.includes('notnull') && (!value || value.trim() === '')) {
        newErrors[col] = `${col} is required (NOT NULL constraint)`;
        return;
      }
      
      // Check type validation if value is not empty
      if (value && value.trim() !== '' && !validateType(value, validationType)) {
        switch (validationType) {
          case 'number':
            newErrors[col] = `${col} must be a valid number (${sqlType})`;
            break;
          case 'integer':
            newErrors[col] = `${col} must be a valid integer (${sqlType})`;
            break;
          case 'boolean':
            newErrors[col] = `${col} must be true/false, 1/0, or yes/no (${sqlType})`;
            break;
          case 'date':
            newErrors[col] = `${col} must be a valid date (${sqlType} format: YYYY-MM-DD)`;
            break;
          default:
            newErrors[col] = `${col} has an invalid value for type ${sqlType}`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    
    const isValid = validateForm();
    if (isValid) {
      onSave(form);
    }
    // If not valid, errors are already set and will be displayed
  }

  function handleInputChange(col, value) {
    setForm(f => ({ ...f, [col]: value }));
    
    // Real-time validation for immediate feedback
    const colIndex = columns.indexOf(col);
    const sqlType = types[colIndex] || 'VARCHAR';
    const validationType = mapSqlTypeToValidationType(sqlType);
    const columnConstraints = constraints[colIndex] || [];
    
    // Clear existing error first
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[col];
      return newErrors;
    });
    
    // If value is empty and field is required, show error
    if (columnConstraints.includes('notnull') && (!value || value.trim() === '')) {
      setErrors(prev => ({
        ...prev,
        [col]: `${col} is required (NOT NULL constraint)`
      }));
      return;
    }
    
    // If value is not empty, validate type
    if (value && value.trim() !== '' && !validateType(value, validationType)) {
      let errorMessage;
      switch (validationType) {
        case 'number':
          errorMessage = `${col} must be a valid number (${sqlType})`;
          break;
        case 'integer':
          errorMessage = `${col} must be a valid integer (${sqlType})`;
          break;
        case 'boolean':
          errorMessage = `${col} must be true/false, 1/0, or yes/no (${sqlType})`;
          break;
        case 'date':
          errorMessage = `${col} must be a valid date (${sqlType} format: YYYY-MM-DD)`;
          break;
        default:
          errorMessage = `${col} has an invalid value for type ${sqlType}`;
      }
      
      setErrors(prev => ({
        ...prev,
        [col]: errorMessage
      }));
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Edit Entry</h2>
        <form onSubmit={handleSubmit}>
          {columns.map((col, idx) => {
            const sqlType = types[idx] || 'VARCHAR';
            const validationType = mapSqlTypeToValidationType(sqlType);
            const columnConstraints = constraints[idx] || [];
            const isEditable = violationCols.length === 0 || violationCols.includes(col);
            const hasError = errors[col];
            
            return (
              <div key={col} style={{ marginBottom: 16 }}>
                <label style={{ 
                  fontWeight: 500, 
                  display: 'block', 
                  marginBottom: 4,
                  color: hasError ? '#d32f2f' : 'inherit'
                }}>
                  {col}
                  {columnConstraints.includes('notnull') && <span style={{ color: '#d32f2f' }}> *</span>}
                  {columnConstraints.includes('primary') && <span style={{ color: '#1976d2', fontSize: '0.8em' }}> (PK)</span>}
                  {columnConstraints.includes('unique') && <span style={{ color: '#388e3c', fontSize: '0.8em' }}> (UNIQUE)</span>}
                </label>
                <input
                  type={getInputType(sqlType)}
                  value={form[col] || ''}
                  onChange={e => handleInputChange(col, e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '8px 12px', 
                    borderRadius: 4,
                    border: hasError ? '2px solid #d32f2f' : '1px solid #ccc',
                    backgroundColor: !isEditable ? '#f5f5f5' : 'white',
                    fontSize: 14
                  }}
                  disabled={!isEditable}
                  placeholder={getPlaceholder(sqlType, columnConstraints)}
                />
                {hasError && (
                  <div style={{ 
                    color: '#d32f2f', 
                    fontSize: '0.875rem', 
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ marginRight: 4 }}>⚠</span>
                    {errors[col]}
                  </div>
                )}
                {!hasError && validationType !== 'string' && (
                  <div style={{ 
                    color: '#666', 
                    fontSize: '0.75rem', 
                    marginTop: 2 
                  }}>
                    Type: {sqlType}
                  </div>
                )}
              </div>
            );
          })}
          <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                borderRadius: 4,
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 4,
                backgroundColor: '#1976d2',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEntryModal;
