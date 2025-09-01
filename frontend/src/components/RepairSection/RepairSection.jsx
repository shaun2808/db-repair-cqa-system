import React from 'react';
import './RepairSection.css';

function RepairSection({ repairFiles, onSelect, selectedFile }) {
  // Helper function to get user-friendly repair name
  const getRepairDisplayName = (file) => {
    if (!file.name) return 'Repair File';
    
    if (file.name.includes('_partial_repair_custom')) {
      return 'Custom';
    } else if (file.name.includes('_partial_repair_1')) {
      return 'Partial Repair 1';
    } else if (file.name.includes('_partial_repair_2')) {
      return 'Partial Repair 2';
    } else if (file.name.includes('_repair_custom')) {
      return 'Custom';
    } else if (file.name.includes('_repair_1')) {
      return 'Repair Strategy 1';
    } else if (file.name.includes('_repair_2')) {
      return 'Repair Strategy 2';
    } else if (file.name.includes('_repair_3')) {
      return 'Repair Strategy 3';
    } else {
      // Extract repair number if present
      const match = file.name.match(/_repair_(\d+)/);
      if (match) {
        return `Repair Strategy ${match[1]}`;
      }
      return 'Repair File';
    }
  };

  const handleFileSelect = (fileName) => {
    const selectedRepairFile = repairFiles.find(f => f.name === fileName);
    onSelect(fileName);
  };

  return (
    <aside className="repair-section-new stylish">
      <div className="repair-section-header">
        <h2>Repair Files</h2>
      </div>
      <ul>
        {repairFiles && repairFiles.length > 0 ? (
          repairFiles.map((file, idx) => (
            <li
              key={file.name || idx}
              className={selectedFile === file.name ? 'selected' : ''}
              onClick={() => handleFileSelect(file.name)}
            >
              <div className="repair-file-content">
                <span className="repair-file-icon">🛠️</span>
                <div className="repair-file-info">
                  <span className="repair-file-title">{getRepairDisplayName(file)}</span>
                  <span className="repair-file-rows">{file.rows?.length || 0} rows</span>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="empty">No repair files</li>
        )}
      </ul>
    </aside>
  );
}

export default RepairSection;
