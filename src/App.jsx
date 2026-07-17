  import { useState, useEffect } from 'react';
  import CodeViewer from './CodeViewer'; // 
  import './App.css';

  function App() {
    const [topology, setTopology] = useState({ 
      hosts: [{ id: 'h1', ip: '10.0.0.1' }], 
      switches: [{ id: 's1' }], 
      links: [] 
    });
    const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
      const fetchCode = async () => {
        try {
          const response = await fetch('http://localhost:5000/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...topology, mode: 'build' })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          setGeneratedCode(data); // This updates your state and shows the code!
        } catch (error) {
          console.error("Error fetching code:", error);
        }
      };

    fetchCode();
  }, [topology]);

    const loadMockData = () => {
    setTopology({
      hosts: [
        { id: 'h1', ip: '10.0.0.1' },
        { id: 'h2', ip: '10.0.0.2' },
        { id: 'h3', ip: '10.0.0.3' }
      ],
      switches: [
        { id: 's1' }
      ],
      links: [
        { source: 'h1', target: 's1', weight: 10 },
        { source: 'h2', target: 's1', weight: 20 }
      ]
    });
  };

    return (
      
      <div className="main-container">
        <button onClick={loadMockData} style={{ marginRight: '10px' }}>
            Load Test Topology
        </button>
        <div className="canvas">
        </div>

        {}
        <CodeViewer code={generatedCode} />
      </div>
    );

    
  }

  export default App;