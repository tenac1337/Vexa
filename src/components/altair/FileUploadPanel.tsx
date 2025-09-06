import React from 'react';

const FileUploadPanel: React.FC = () => {
  return (
    <div className="file-upload-panel">
      <h3>PDF Upload</h3>
      <input type="file" accept=".pdf" />
    </div>
  );
};

export default FileUploadPanel;