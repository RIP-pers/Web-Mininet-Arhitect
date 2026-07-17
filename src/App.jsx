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
  // Pentru Host: o singură placă de rețea -> un singur segment, fără slot,
  // și fără numerotare incrementală (un PC obișnuit are mereu GigabitEthernet0)
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
  
  // Calculează punctele pentru label-uri (1/3 și 2/3 pe linie)
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

  // --- COUNTERE PENTRU ID-URI STIL h1/h2.../s1/s2... ---
  const hostCounterRef = useRef(0);
  const switchCounterRef = useRef(0);

  // --- EXPORT LIVE: build.txt (JSON trimis la backend) ---
  const [liveJson, setLiveJson] = useState('{}');
  const [exportPanelOpen, setExportPanelOpen] = useState(false);

  const showError = (msg) => {
    setErrorMessage(msg);
    window.clearTimeout(showError._t);
    showError._t = window.setTimeout(() => setErrorMessage(null), 3500);
  };

  // De fiecare dată când se adaugă/șterge un host, un switch, o conexiune,
  // sau se editează weight/bw pe o legătură, trimitem JSON-ul la backend,
  // care suprascrie mereu build.txt și se ocupă de generarea codului Mininet + Dijkstra
  useEffect(() => {
    const topology = buildTopologyObject(nodes, edges);
    const jsonStr = JSON.stringify(topology, null, 2);

    setLiveJson(jsonStr);

    fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    }).catch(() => {
      // backend indisponibil - ignorăm silențios, JSON-ul rămâne vizibil în panou
    });
  }, [nodes, edges]);

  // De fiecare dată când se adaugă/șterge un host, un switch, o conexiune...
  useEffect(() => {
    const topology = buildTopologyObject(nodes, edges);
    const jsonStr = JSON.stringify(topology, null, 2);

    setLiveJson(jsonStr);

    fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    }).catch(() => {
      // backend indisponibil - ignorăm silențios
    });
  }, [nodes, edges]);

  // =============================================================
  // ---> AICI ADAUGI NOUL COD PENTRU ACTUALIZAREA ÎN TIMP REAL <---
  // =============================================================
  useEffect(() => {
    setEdges((eds) => {
      let hasChanges = false;
      
      const updatedEdges = eds.map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const { sourceHandle, targetHandle } = getClosestHandles(
            sourceNode.position,
            targetNode.position
          );

          if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
            hasChanges = true;
            return { 
                ...edge, 
                sourceHandle, 
                targetHandle 
            };
          }
        }
        return edge;
      });

      return hasChanges ? updatedEdges : eds;
    });
  }, [nodes, setEdges]);
  // =============================================================

 

// ... restul codului tău continuă la fel
  















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

      // Atribuim un id "prietenos" (h1, h2... / s1, s2...) folosit apoi în build.txt și în scriptul Mininet
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
        <button
          className="button"
          onClick={() => setExportPanelOpen((o) => !o)}
        >
          {exportPanelOpen ? 'Ascunde build.txt' : 'build.txt'}
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
            <span className="export-title">build.txt</span>
            <button
              className="export-close"
              onClick={() => setExportPanelOpen(false)}
              aria-label="Închide"
            >
              ✕
            </button>
          </div>
          <pre className="export-code">{liveJson}</pre>
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