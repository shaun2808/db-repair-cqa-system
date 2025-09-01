import React from 'react';
import './ColumnConfigModal.css';

function ColumnConfigModal({ columns, onConfirm, onCancel, show, detectedTypes, setTypes, constraints, setConstraints, files = [], fileTables = {} }) {
  if (!show) return null;

  // constraints is now an array of arrays (per column)
  const constraintOptions = [
    { value: 'primary', label: 'Primary Key' },
    { value: 'unique', label: 'Unique' },
    { value: 'notnull', label: 'Not Null' },
    { value: 'foreign', label: 'Foreign Key' }
  ];

  // Handler for toggling a constraint for a column
  const handleConstraintToggle = (colIdx, constraint) => {
    setConstraints((prev) => {
      const newArr = prev.map((arr, idx) =>
        idx === colIdx
          ? arr.includes(constraint)
            ? arr.filter((c) => c !== constraint)
            : [...arr, constraint]
          : arr
      );
      return newArr;
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Configure Columns</h2>
        <form onSubmit={e => { e.preventDefault(); onConfirm(); }}>
          <table className="modal-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Data Type</th>
                <th>Integrity Constraints</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => (
                <tr key={col}>
                  <td>{col}</td>
                  <td>
                    <select value={detectedTypes[idx]} onChange={e => setTypes(idx, e.target.value)}>
                      <option value="VARCHAR">VARCHAR</option>
                      <option value="INT">INT</option>
                      <option value="BIGINT">BIGINT</option>
                      <option value="FLOAT">FLOAT</option>
                      <option value="DOUBLE">DOUBLE</option>
                      <option value="DATE">DATE</option>
                      <option value="DATETIME">DATETIME</option>
                      <option value="TEXT">TEXT</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                    </select>
                  </td>
                  <td>
                    <div className="constraint-checkboxes">
                      {constraintOptions.map(opt => (
                        <label key={opt.value} style={{ marginRight: '1.2em', fontWeight: 500 }}>
                          <input
                            type="checkbox"
                            checked={constraints[idx]?.includes(opt.value) || false}
                            onChange={() => handleConstraintToggle(idx, opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                      {/* Foreign key reference selector */}
                      {constraints[idx]?.includes('foreign') && files.length > 1 && (
                        <div style={{ marginTop: '0.5em' }}>
                          <span style={{ fontWeight: 500, marginRight: 6 }}>References:</span>
                          <select
                            value={constraints[idx]?.fkRef || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setConstraints(prev => prev.map((arr, i) =>
                                i === idx ? [...arr.filter(c => typeof c !== 'object' && c !== 'fkRef'), { fkRef: val }] : arr
                              ));
                            }}
                          >
                            <option value="">Select table.column</option>
                            {files.filter(f => f !== files[0]).map(f => (
                              fileTables[f]?.columns?.map(col2 => (
                                <option key={f + '.' + col2} value={f + '.' + col2}>{f} . {col2}</option>
                              ))
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit">Confirm</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ColumnConfigModal;
