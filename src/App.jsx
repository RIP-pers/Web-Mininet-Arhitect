import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Handle,      
  Position,
  BaseEdge,
  EdgeLabelRenderer
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

// Importă imaginile
import hostImg from './assets/host.png';
import switchImg from './assets/switch.png';
import linkImg from './assets/link.png';

// --- DEFINIRE NOD PERSONALIZAT ---
const ImageNode = ({ data }) => {
  const getDisplayName = (id) => {
    if (!id) return '';
    if (id.startsWith('h')) return id.replace('h', 'PC');
    if (id.startsWith('s')) return id.replace('s', 'Switch ');
    return id;
  };

  return (
    <div className="node-wrapper">
      {/* Container nou doar pentru imagine și handle-uri */}
      <div className="image-container">
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />

        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />

        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />

        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />

        <img
          src={data.image}
          alt={data.label}
          className={data.isSourceSelected ? 'device-image selected-source' : 'device-image'}
        />
      </div>

      {/* Eticheta text rămâne în afara containerului de imagine */}
      <div className="device-label">
        {getDisplayName(data.deviceId)}
      </div>
    </div>
  );
};

const nodeTypes = { customImage: ImageNode };

let idCounter = 0;
const getId = () => `nod_${idCounter++}`;

// Determină handle-urile în funcție de zona în care se află nodul țintă
// Consolidează toate conexiunile dintr-o zonă pe un singur handle
const getClosestHandles = (sourcePos, targetPos) => {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  // Dacă diferența pe orizontală e mai mare, e pe stânga/dreapta
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      // Ținta e în DREAPTA sursei
      return { sourceHandle: 'right-source', targetHandle: 'left-target' };
    } else {
      // Ținta e în STÂNGA sursei
      return { sourceHandle: 'left-source', targetHandle: 'right-target' };
    }
  } else {
    // Dacă diferența pe verticală e mai mare, e sus/jos
    if (dy > 0) {
      // Ținta e în JOS de sursă
      return { sourceHandle: 'bottom-source', targetHandle: 'top-target' };
    } else {
      // Ținta e în SUS de sursă
      return { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
    }
  }
};

// Calculează interfața pentru un nod pe baza tipului și numărului de conexiuni
const getInterfaceForNode = (nodeId, edges, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // Numără conexiunile DOAR pentru acest nod
  const connectedEdges = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );
  const interfaceNumber = connectedEdges.length + 1;

  // Pentru Switch (switch fix, neconfigurabil modular): slot/port -> Fa0/1, Fa0/2...
  if (node.data.label === 'Switch') {
    return `Fa0/${interfaceNumber}`;
  }
  // Pentru Host: o singură placă de rețea -> o singură interfață fixă
  if (node.data.label === 'Host') {
    return `Gig0/0/1`;
  }

  return `eth${interfaceNumber}`;
};

// Numără câte conexiuni active are deja un nod
const getNodeConnectionCount = (nodeId, edges) =>
  edges.filter((e) => e.source === nodeId || e.target === nodeId).length;

// Validează dacă o conexiune respectă o topologie realistă (stil Packet Tracer):
// - un Host are o singură placă de rețea -> maxim 1 conexiune activă
// - hosturile nu se conectează direct între ele (doar prin Switch)
const validateConnection = (sourceNode, targetNode, edges) => {
  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'Nod invalid.' };
  }
  if (sourceNode.id === targetNode.id) {
    return { valid: false, reason: 'Nu te poți conecta la același nod.' };
  }

  const isSourceHost = sourceNode.data.label === 'Host';
  const isTargetHost = targetNode.data.label === 'Host';

  if (isSourceHost && getNodeConnectionCount(sourceNode.id, edges) >= 1) {
    return {
      valid: false,
      reason: 'Acest host are deja o conexiune activă (are o singură placă de rețea).',
    };
  }
  if (isTargetHost && getNodeConnectionCount(targetNode.id, edges) >= 1) {
    return {
      valid: false,
      reason: 'Hostul țintă are deja o conexiune activă (are o singură placă de rețea).',
    };
  }
  if (isSourceHost && isTargetHost) {
    return {
      valid: false,
      reason: 'Hosturile nu se pot conecta direct între ele — conectează-le printr-un Switch.',
    };
  }

  return { valid: true };
};

// Custom edge cu două label-uri
const CustomEdgeWithDualLabels = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}) => {
  const edgePath = `M${sourceX},${sourceY}L${targetX},${targetY}`;

  // Calculează punctele pentru label-uri (1/4 și 3/4 pe linie)
  const labelSourceX = sourceX + (targetX - sourceX) * 0.25;
  const labelSourceY = sourceY + (targetY - sourceY) * 0.25;
  const labelTargetX = sourceX + (targetX - sourceX) * 0.75;
  const labelTargetY = sourceY + (targetY - sourceY) * 0.75;

  return (
    <>
      <BaseEdge path={edgePath} style={style} />
      <EdgeLabelRenderer>
        {data?.sourceInterface && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelSourceX}px,${labelSourceY}px)`,
              pointerEvents: 'all',
              backgroundColor: '#1a1a2e',
              color: '#00ff00',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '3px',
              border: '1px solid #00ff00',
              whiteSpace: 'nowrap',
            }}
          >
            {data.sourceInterface}
          </div>
        )}
        {data?.targetInterface && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelTargetX}px,${labelTargetY}px)`,
              pointerEvents: 'all',
              backgroundColor: '#1a1a2e',
              color: '#00ff00',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '3px',
              border: '1px solid #00ff00',
              whiteSpace: 'nowrap',
            }}
          >
            {data.targetInterface}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = { dualLabel: CustomEdgeWithDualLabels };

// --- COMPONENTĂ PENTRU AFIȘAREA CODULUI GENERAT DE BACKEND (fost CodeViewer.jsx) ---
// Inclusă direct aici, ca să nu mai fie nevoie de un fișier separat.
const CodeViewer = ({ code }) => {
  // Backend-ul poate întoarce fie direct un string cu codul Python,
  // fie un obiect de forma { code: '...' } - acoperim ambele cazuri
  const displayCode =
    typeof code === 'string'
      ? code
      : code?.code ?? (code ? JSON.stringify(code, null, 2) : '');

  return (
    <pre className="export-code">
      {displayCode || '// Codul generat de backend va apărea aici...'}
    </pre>
  );
};

// Construiește obiectul de topologie (mode/hosts/switches/links) pornind de
// la nodurile și conexiunile curente din canvas — format identic cu cel
// discutat pentru build.txt (id-uri stil h1/h2/s1, ip, weight, bw, active)
const buildTopologyObject = (nodes, edges) => {
  const hostNodes = nodes.filter((n) => n.data.label === 'Host');
  const switchNodes = nodes.filter((n) => n.data.label === 'Switch');

  const hosts = hostNodes.map((n) => ({
    id: n.data.deviceId,
    ip: n.data.ip,
  }));

  const switches = switchNodes.map((n) => ({
    id: n.data.deviceId,
  }));

  const links = edges.map((e) => {
    const srcNode = nodes.find((n) => n.id === e.source);
    const tgtNode = nodes.find((n) => n.id === e.target);
    return {
      source: srcNode?.data.deviceId ?? null,
      target: tgtNode?.data.deviceId ?? null,
      weight: e.data?.weight ?? 1,
      bw: e.data?.bw ?? 100,
      active: e.data?.active ?? true,
    };
  });

  return { mode: 'build', hosts, switches, links };
};

export default function App() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // --- STATE PENTRU MODUL DE CONECTARE (LINK) ---
  const [linkMode, setLinkMode] = useState(false);
  const [sourceNode, setSourceNode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [rewireMode, setRewireMode] = useState(false);
  const [rewireStart, setRewireStart] = useState('h1');
  const [rewireEnd, setRewireEnd] = useState('h2');

  // --- COUNTERE PENTRU ID-URI STIL h1/h2.../s1/s2... ---
  const hostCounterRef = useRef(0);
  const switchCounterRef = useRef(0);

  // --- EXPORT LIVE: build.txt (JSON) + cod generat de backend (CodeViewer) ---
  const [liveJson, setLiveJson] = useState('{}');
  const [generatedCode, setGeneratedCode] = useState('');
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('json'); // 'json' | 'code'

  const showError = (msg) => {
    setErrorMessage(msg);
    window.clearTimeout(showError._t);
    showError._t = window.setTimeout(() => setErrorMessage(null), 3500);
  };

  // De fiecare dată când se adaugă/șterge un host, un switch, o conexiune,
  // sau se editează weight/bw pe o legătură:
  //  1) trimitem JSON-ul la backend, care suprascrie mereu build.txt
  //  2) cerem backend-ului codul generat (Mininet), pe baza aceleiași topologii,
  //     și îl afișăm live prin CodeViewer
  useEffect(() => {
    const topology = buildTopologyObject(nodes, edges);
    const jsonStr = JSON.stringify(topology, null, 2);
    setLiveJson(jsonStr);

    // Dacă suntem în modul Rewire, oprim generarea de script Mininet!
    if (rewireMode) return;

    // 1) Salvare build.txt
    fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    }).catch(() => {});

    // 2) Generare cod (Mininet)
    fetch('http://localhost:5000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topology),
    })
      .then((res) => res.json())
      .then((data) => setGeneratedCode(data))
      .catch((err) => console.error('Eroare la generarea codului:', err));
  }, [nodes, edges, rewireMode]); // <-- Adaugă rewireMode la final aici

  // Ține conexiunile lipite de partea corectă a nodului atunci când acesta e mutat
  useEffect(() => {
    setEdges((eds) => {
      let hasChanges = false;

      const updatedEdges = eds.map((edge) => {
        const srcNode = nodes.find((n) => n.id === edge.source);
        const tgtNode = nodes.find((n) => n.id === edge.target);

        if (srcNode && tgtNode) {
          const { sourceHandle, targetHandle } = getClosestHandles(
            srcNode.position,
            tgtNode.position
          );

          if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
            hasChanges = true;
            return { ...edge, sourceHandle, targetHandle };
          }
        }
        return edge;
      });

      return hasChanges ? updatedEdges : eds;
    });
  }, [nodes, setEdges]);

  // --- FUNCȚII PENTRU MODUL REWIRE (DIJKSTRA) ---

  const highlightPathInReact = (pathNodes, currentEdges) => {
    setEdges(currentEdges.map(edge => {
      const srcDeviceId = nodes.find(n => n.id === edge.source)?.data.deviceId;
      const tgtDeviceId = nodes.find(n => n.id === edge.target)?.data.deviceId;

      // Verificăm dacă muchia conectează 2 noduri consecutive din ruta Dijkstra
      let isPathEdge = false;
      if (pathNodes && pathNodes.length > 1) {
        for (let i = 0; i < pathNodes.length - 1; i++) {
          if ((pathNodes[i] === srcDeviceId && pathNodes[i+1] === tgtDeviceId) ||
              (pathNodes[i] === tgtDeviceId && pathNodes[i+1] === srcDeviceId)) {
            isPathEdge = true;
            break;
          }
        }
      }

      if (isPathEdge) {
        // Colorează ruta cu VERDE și adaugă animație de pachete
        return { ...edge, animated: true, style: { stroke: '#00ff00', strokeWidth: 4 } };
      } else {
        // Dacă nu e în rută, o face mai ștearsă/gri
        return { ...edge, animated: false, style: { stroke: '#555', strokeWidth: 2, opacity: 0.5 } };
      }
    }));
  };

  const calculateRewire = async (currentEdges) => {
    const topology = buildTopologyObject(nodes, currentEdges);
    const payload = {
      ...topology,
      mode: 'rewire',
      start_node: rewireStart,
      end_node: rewireEnd
    };

    try {
      const res = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      // Verificăm statusul din backend-ul tău
      if (data.status === 'succes' || data.status === 'success') {
        highlightPathInReact(data.path, currentEdges);
      } else {
        showError(data.message || "Ruta a fost complet distrusă!");
        // Facem toate muchiile roșii dacă rețeaua e complet izolată
        setEdges(currentEdges.map(e => ({ ...e, animated: false, style: { stroke: 'red', strokeWidth: 3 } })));
      }
    } catch (err) {
      console.error(err);
      showError("Eroare conexiune server Flask!");
    }
  };

  // Eveniment de tăiere a cablului (Click)
  const onEdgeClick = useCallback((event, edge) => {
    if (!rewireMode) return;
    event.stopPropagation(); // Previne alte click-uri subiacente

    // 1. Tăiem firul (îl scoatem din lista de edges)
    const newEdges = edges.filter(e => e.id !== edge.id);
    setEdges(newEdges);

    // 2. Apelăm backend-ul pentru recalculare instantanee
    calculateRewire(newEdges);
  }, [rewireMode, edges, nodes, rewireStart, rewireEnd]);

  // Funcția care comută modurile
  const toggleRewireMode = () => {
    const newMode = !rewireMode;
    setRewireMode(newMode);
    
    if (newMode) {
      // Când intrăm în Rewire, dezactivăm modul de link (pentru a nu se suprapune)
      setLinkMode(false);
      clearSourceSelection();
      // Calculăm ruta inițială înainte să tăiem vreun fir
      calculateRewire(edges);
    } else {
      // Când ieșim, readucem cablurile la vizualul normal
      setEdges(eds => eds.map(e => ({ ...e, animated: false, style: {} })));
    }
  };

  // Verificare live, cât timp utilizatorul trage cablul din handle
  const isValidConnection = useCallback(
    (connection) => {
      const srcNode = nodes.find((n) => n.id === connection.source);
      const tgtNode = nodes.find((n) => n.id === connection.target);
      const result = validateConnection(srcNode, tgtNode, edges);
      return result.valid;
    },
    [nodes, edges]
  );

  const onConnect = useCallback(
    (params) => {
      const srcNode = nodes.find((n) => n.id === params.source);
      const tgtNode = nodes.find((n) => n.id === params.target);
      const result = validateConnection(srcNode, tgtNode, edges);

      if (!result.valid) {
        showError(result.reason);
        return;
      }

      setEdges((eds) => {
        const sourceInterface = getInterfaceForNode(params.source, eds, nodes);
        const targetInterface = getInterfaceForNode(params.target, eds, nodes);
        return addEdge(
          {
            ...params,
            type: 'dualLabel',
            data: { sourceInterface, targetInterface },
          },
          eds
        );
      });
    },
    [setEdges, nodes, edges]
  );

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      // Mapare corectă pentru sursa imaginii
      let imgSource = null;
      if (type === 'Host') imgSource = hostImg;
      if (type === 'Switch') imgSource = switchImg;
      if (type === 'Link') imgSource = linkImg;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Atribuim un id "prietenos" (h1, h2... / s1, s2...) folosit apoi în build.txt și în codul generat
      let deviceId = null;
      let ip = null;
      if (type === 'Host') {
        hostCounterRef.current += 1;
        deviceId = `h${hostCounterRef.current}`;
        ip = `10.0.0.${hostCounterRef.current}`;
      } else if (type === 'Switch') {
        switchCounterRef.current += 1;
        deviceId = `s${switchCounterRef.current}`;
      }

      const newNode = {
        id: getId(),
        type: 'customImage', 
        position,
        data: { label: type, image: imgSource, isSourceSelected: false, deviceId, ip }, 
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // --- TOGGLE MOD LINK (apăsare pe iconița de cablu din header) ---
  const toggleLinkMode = () => {
    setLinkMode((m) => {
      const newMode = !m;
      if (!newMode) {
        // dacă dezactivăm manual modul, resetăm și selecția
        clearSourceSelection();
      }
      return newMode;
    });
  };

  // Resetează evidențierea vizuală de pe nodul sursă
  const clearSourceSelection = () => {
    setSourceNode(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSourceSelected: false },
      }))
    );
  };

  // --- CLICK PE NOD: logica de conectare ---
  const onNodeClick = useCallback(
    (event, node) => {
      if (!linkMode) return;

      if (!sourceNode) {
        // Primul click: salvăm nodul sursă și îl evidențiem vizual
        setSourceNode(node);
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: { ...n.data, isSourceSelected: n.id === node.id },
          }))
        );
      } else {
        // Al doilea click: creăm conexiunea, dacă e alt nod și e validă
        if (sourceNode.id !== node.id) {
          const result = validateConnection(sourceNode, node, edges);

          if (!result.valid) {
            showError(result.reason);
            // Nu resetăm selecția - lăsăm utilizatorul să aleagă alt nod țintă
            return;
          }

          const { sourceHandle, targetHandle } = getClosestHandles(
            sourceNode.position,
            node.position
          );

          setEdges((eds) => {
            // Calculează interfețele pentru nodul sursă și țintă
            const sourceInterface = getInterfaceForNode(sourceNode.id, eds, nodes);
            const targetInterface = getInterfaceForNode(node.id, eds, nodes);

            const newEdge = {
              source: sourceNode.id,
              target: node.id,
              sourceHandle,
              targetHandle,
              type: 'dualLabel',
              data: {
                sourceInterface,
                targetInterface,
              },
            };

            return addEdge(newEdge, eds);
          });

          // Resetăm selecția și ieșim din modul link doar dacă am reușit conexiunea
          setLinkMode(false);
          clearSourceSelection();
        }
      }
    },
    [linkMode, sourceNode, setEdges, setNodes, nodes, edges]
  );

  // --- DUBLU-CLICK PE O CONEXIUNE: setează weight/bw pentru acea legătură ---
  const onEdgeDoubleClick = useCallback(
    (event, edge) => {
      event.stopPropagation();

      const currentWeight = edge.data?.weight ?? 1;
      const currentBw = edge.data?.bw ?? 100;

      const weightInput = window.prompt(
        'Weight (costul legăturii, folosit de Dijkstra):',
        currentWeight
      );
      if (weightInput === null) return; // utilizatorul a anulat

      const parsedWeight = Number(weightInput);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        showError('Weight-ul trebuie să fie un număr pozitiv.');
        return;
      }

      const bwInput = window.prompt(
        'Bandwidth (Mbps, capacitatea legăturii):',
        currentBw
      );
      if (bwInput === null) return;

      const parsedBw = Number(bwInput);
      if (!Number.isFinite(parsedBw) || parsedBw <= 0) {
        showError('Bandwidth-ul trebuie să fie un număr pozitiv.');
        return;
      }

      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? { ...e, data: { ...e.data, weight: parsedWeight, bw: parsedBw } }
            : e
        )
      );
    },
    [setEdges]
  );

  // --- CLICK-DREAPTA PE UN NOD: șterge nodul + toate conexiunile lui ---
  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();

      setEdges((eds) =>
        eds.filter((e) => e.source !== node.id && e.target !== node.id)
      );
      setNodes((nds) => nds.filter((n) => n.id !== node.id));

      // dacă nodul șters era selectat ca sursă în modul link, resetăm selecția
      if (sourceNode?.id === node.id) {
        setSourceNode(null);
        setLinkMode(false);
      }
    },
    [setEdges, setNodes, sourceNode]
  );

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-buttons">
          <img
            src={hostImg}
            className="draggable-icon"
            alt="Host"
            draggable
            onDragStart={(e) => onDragStart(e, 'Host')}
          />
          <img
            src={switchImg}
            className="draggable-icon"
            alt="Switch"
            draggable
            onDragStart={(e) => onDragStart(e, 'Switch')}
          />
          <img
            src={linkImg}
            className={linkMode ? 'draggable-icon active-tool' : 'draggable-icon'}
            alt="Link"
            onClick={toggleLinkMode}
          />
        </div>
        {rewireMode && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#333', padding: '5px 10px', borderRadius: '5px' }}>
            <span style={{color: 'white', fontSize: '12px'}}>Source:</span>
            <input 
              style={{width: '40px', padding: '3px'}} 
              value={rewireStart} 
              onChange={e => setRewireStart(e.target.value)} 
            />
            <span style={{color: 'white', fontSize: '12px'}}>Destination:</span>
            <input 
              style={{width: '40px', padding: '3px'}} 
              value={rewireEnd} 
              onChange={e => setRewireEnd(e.target.value)} 
            />
          </div>
        )}
        <button
          className="button"
          onClick={toggleRewireMode}
          style={{ backgroundColor: rewireMode ? '#610474' : '#d840e2' }}
        >
          {rewireMode ? 'Stop Rewire' : 'Start Rewire'}
        </button>
        <button
          className="button"
          onClick={() => setExportPanelOpen((o) => !o)}
        >
          {exportPanelOpen ? 'Ascunde panoul' : 'Generated code'}
        </button>
      </header>

      {errorMessage && (
        <div className="error-banner">
          {errorMessage}
        </div>
      )}

      {exportPanelOpen && (
        <div className="export-panel">
          <div className="export-panel-header">
            <div className="export-tabs">
              <button
                className={activeTab === 'json' ? 'export-tab active' : 'export-tab'}
                onClick={() => setActiveTab('json')}
              >
                build.txt
              </button>
              <button
                className={activeTab === 'code' ? 'export-tab active' : 'export-tab'}
                onClick={() => setActiveTab('code')}
              >
                Cod generat
              </button>
            </div>
            <button
              className="export-close"
              onClick={() => setExportPanelOpen(false)}
              aria-label="Închide"
            >
              ✕
            </button>
          </div>



          {activeTab === 'json' ? (
            <pre className="export-code">{liveJson}</pre>
          ) : (
            <CodeViewer code={generatedCode} />
          )}
        </div>
      )}

      <div className="whitespace" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgeClick={onEdgeClick}
          nodesConnectable={!rewireMode}
          nodesDraggable={!rewireMode}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'dualLabel' }}
          fitView
        >
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}