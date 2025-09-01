import React, { useState } from 'react';
import { FaTools, FaCheckCircle } from 'react-icons/fa';
import './RepairPanel.css';


function RepairPanel({
  checkDisabled,
  onCheckRepair,
  onRepair,
  checkResults,
  onClearViolations,
  repairTriggered,
  repairFileObj,
  handleExport
}) {
  // Always show Check Repair if repairTriggered, else show Repair if violations found
  const showRepair = !repairTriggered && checkResults && checkResults.length > 0;
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  return (
    <aside className="repair-panel-new stylish">
        <FaTools className="repair-main-icon" />
        <span className="repair-title">Repair & Checks</span>
      <div className="repair-panel-actions">
        {showRepair ? (
          <button className="repair-btn repair solid-green" onClick={onRepair}>
            Repair
          </button>
        ) : (
          <button className="repair-btn check-repair" disabled={checkDisabled} onClick={onCheckRepair}>Check Repair</button>
        )}
      </div>
      {/* Export dropdown: only show after repairs and no violations */}
      {repairTriggered && repairFileObj && checkResults && checkResults.length === 0 && (
        <div className="export-dropdown-row">
          <div className="export-dropdown-container">
            <button
              className="export-dropdown-btn"
              onClick={() => setExportDropdownOpen(v => !v)}
              onBlur={e => setTimeout(() => setExportDropdownOpen(false), 150)}
            >
              Export ▼
            </button>
            {exportDropdownOpen && (
              <div className="export-dropdown-menu">
                <div
                  className="export-dropdown-item"
                  onMouseDown={e => { e.preventDefault(); handleExport('csv'); setExportDropdownOpen(false); }}
                >
                  CSV
                </div>
                <div
                  className="export-dropdown-item"
                  onMouseDown={e => { e.preventDefault(); handleExport('json'); setExportDropdownOpen(false); }}
                >
                  JSON
                </div>
                <div
                  className="export-dropdown-item"
                  style={{ borderBottom: 'none' }}
                  onMouseDown={e => { e.preventDefault(); handleExport('mysql'); setExportDropdownOpen(false); }}
                >
                  .sql
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="repair-content-new">
        {checkResults && checkResults.length > 0 ? (
          <div className="violation-list">
            <button className="violation-close" onClick={onClearViolations} title="Close">×</button>
            <h3>Violations Found:</h3>
            <ul>
              {checkResults.map((v, i) => (
                <li key={i}>
                  Row {v.row}, Column <b>{v.col}</b>: <b>{v.type}</b> - {v.msg}
                </li>
              ))}
            </ul>
          </div>
        ) : checkResults && checkResults.length === 0 ? (
          <div className="violation-list success">
            <button className="violation-close" onClick={onClearViolations} title="Close">×</button>
            No violations found. The table satisfies all constraints.
          </div>
        ) : (
          <p>Repair actions and checks will appear here.</p>
        )}
      </div>
    </aside>
  );
}

export default RepairPanel;
