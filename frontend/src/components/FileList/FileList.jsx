
import React, { useRef } from 'react';
import './FileList.css';
import { FaFileCsv, FaPlus } from 'react-icons/fa';
import { MdInsertDriveFile } from 'react-icons/md';

function FileList({ files, onSelect, selectedFile, onUpload }) {
  const fileInputRef = useRef();
  const handlePlusClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  return (
    <aside className="file-list-new stylish">
      <div className="filelist-header">
        <FaFileCsv className="csv-main-icon" />
        <h2>Files</h2>
      </div>
      <ul>
        {files && files.length > 0 ? (
          files.map((file, idx) => {
            const fileName = typeof file === 'string' ? file : file.name;
            return (
              <li
                key={fileName || idx}
                className={selectedFile === fileName ? 'selected' : ''}
                onClick={() => onSelect(fileName)}
              >
                <MdInsertDriveFile className="csv-file-icon" />
                <span className="file-name">{fileName}</span>
              </li>
            );
          })
        ) : (
          <li className="empty"><MdInsertDriveFile className="csv-file-icon" /> No files imported</li>
        )}
      </ul>
      {/* Always render the hidden file input for upload */}
      <input
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={onUpload}
      />
      {/* No visible upload button when no files exist */}
      {/* Only show the + button if files exist */}
      {files && files.length > 0 && (
        <div className="filelist-add-btn-row">
          <button className="filelist-add-btn" onClick={handlePlusClick} title="Add CSV File">
            <FaPlus />
          </button>
        </div>
      )}
    </aside>
  );
}

export default FileList;
