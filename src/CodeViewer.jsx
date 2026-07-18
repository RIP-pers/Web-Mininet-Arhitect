import Editor from '@monaco-editor/react';
import './CodeViewer.css';

const CodeViewer = ({ code }) => {
  return (
    <div className="code-viewer-container">
      <div className="console-header">Mininet Script (Auto-generated)</div>
      <Editor
        height="100%"
        defaultLanguage="python"
        theme="vs-dark"
        value={code}
        options={{ 
          readOnly: true, 
          minimap: { enabled: false },
          fontSize: 14 
        }}
      />
    </div>
  );
};

export default CodeViewer;