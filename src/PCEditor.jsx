import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ToastProvider, useToast } from "./context/ToastContext";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import * as THREE from "three";
import Scene from "./components/Scene";
import TopBar from "./components/UI/TopBar";
import LeftSidebar from "./components/UI/LeftSidebar";
import RightSidebar from "./components/UI/RightSidebar";
import ConnectorToast from "./components/UI/ConnectorToast";
import HUD from "./components/UI/HUD";

import { useStore, useTemporalStore } from "./store";
import { ensureSceneConnectors } from "./utils/connectors";
import { expandObjectsWithEmbedded } from "./utils/embeddedParts";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { exportSTLFrom } from "./utils/exportSTL"; // Kept for future use if needed, though handleExport uses JSON currently?
// Original used handleExport with JSON download only, but imported exportSTLFrom?
// Line 12: import { exportSTLFrom } from "./utils/exportSTL";

// Hooks
import { useSelection } from "./hooks/useSelection";
import { useDrillTool } from "./hooks/useDrillTool.jsx";
import { useCutTool } from "./hooks/useCutTool";
import { useRulerTool } from "./hooks/useRulerTool";
import { reduceModifyState } from "./utils/selectionStateLogic";
import { useConnectors } from "./hooks/useConnectors";
import { useTransformInteraction } from "./hooks/useTransformInteraction";

function EditorContent() {
  const { t } = useLanguage();
  const {
    objects,
    setObjects,
    selectedIds,                                    // Selected Object IDs
    setSelectedIds,                                 // Set Selected Object IDs
    connections,
    setConnections,
    projects,
    currentProjectId,
    copyToClipboard,
    pasteFromClipboard,
    setHudState,
    rulerPoints,
    setRulerPoints,
    measurements,
    setMeasurements,
    drillParams,
    hudState, // Added
  } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);
  const { showToast } = useToast();

  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
  const [transformMode, setTransformMode] = useState("translate");
  const [showGizmos, setShowGizmos] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState("library");

  const expandedObjects = useMemo(() => expandObjectsWithEmbedded(objects), [objects]);

  const selectedObject = useMemo(
    () => objects.find((o) => o.id === selectedIds[selectedIds.length - 1]),
    [objects, selectedIds]
  );

  const currentProjectName = useMemo(() => {
    const p = projects.find(p => p.id === currentProjectId);
    return p ? p.name : "";
  }, [projects, currentProjectId]);

  const alignEnabled = transformMode === "translate" || transformMode === "scale" || transformMode === "rotate" || transformMode === "ruler" || transformMode === "drill" || transformMode === "modify";

  // --- Hooks ---
  const selectionTool = useSelection({ objects, setObjects, selectedIds, setSelectedIds });

  const drillTool = useDrillTool({
    objects,
    setObjects,
    selectedObject,
    expandedObjects,
    drillParams,
    transformMode
  });

  const cutTool = useCutTool({
    objects,
    setObjects,
    selectedIds,
    setSelectedIds,
    transformMode,
    setTransformMode
  });

  const rulerTool = useRulerTool({ transformMode }); // Uses useStore internally

  const connectorTool = useConnectors({
    objects,
    setObjects,
    selectedIds,
    setSelectedIds,
    setConnections
  });

  const transformTool = useTransformInteraction({
    objects,
    setObjects,
    expandedObjects,
    setSelectedIds,
    transformMode
  });

  // --- Transform Mode & HUD Logic ---
  const handleTransformModeChange = (mode) => {
    setTransformMode(mode);

    // Reset Selection/HUD when switching Logic Modes
    if (mode === 'connect' || mode === 'subtract' || mode === 'union') {
        setSelectedIds([]);
        setHudState({ type: mode, data: {} });
        return;
    }

    if (mode === 'ruler') {
      setHudState({ type: 'ruler', data: { distance: 0 } });
    } else if (mode === 'drill') {
      setHudState({ type: 'drill', data: {} });
    } else if (mode === 'modify') {
      setHudState({ type: 'modify', data: {} });
    } else {
      if (mode === 'translate') {
        setHudState({
          type: 'move', data: selectedObject ? {
            x: selectedObject.pos[0], y: selectedObject.pos[1], z: selectedObject.pos[2]
          } : {}
        });
      } else if (mode === 'rotate') {
        setHudState({
          type: 'rotate', data: selectedObject ? {
            rx: THREE.MathUtils.radToDeg(selectedObject.rot[0]),
            ry: THREE.MathUtils.radToDeg(selectedObject.rot[1]),
            rz: THREE.MathUtils.radToDeg(selectedObject.rot[2])
          } : {}
        });
      } else if (mode === 'scale') {
        const s = selectedObject?.scale || [1, 1, 1];
        setHudState({
          type: 'scale', data: selectedObject ? {
            sx: s[0], sy: s[1], sz: s[2]
          } : {}
        });
      }
    }
  };

  // Sync Drill State to HUD
  useEffect(() => {
    if (transformMode === 'drill') {
      setHudState({
        type: 'drill',
        data: {
          snapped: drillTool.drillGhost?.snapped,
          position: drillTool.drillGhost?.position
        }
      });
    }
  }, [transformMode, drillTool.drillGhost, setHudState]);

  // Keyboard Shortcuts for Clipboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "c") {
          e.preventDefault();
          if (selectedIds.length > 0) {
            copyToClipboard(selectedIds);
            showToast({ type: "info", text: "Copied to Global Clipboard", ttl: 1500 });
          }
        } else if (e.key === "v") {
          e.preventDefault();
          pasteFromClipboard();
          showToast({ type: "success", text: "Pasted from Global Clipboard", ttl: 1500 });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, copyToClipboard, pasteFromClipboard, showToast]);

  // --- Handlers ---

  const handleFacePick = useCallback(
    (faceInfo) => {
      // Logic delegation
      // Cut Logic
      if (transformMode === 'cut') {
        cutTool.handleCutPick(faceInfo);
        return;
      }

      if (!alignEnabled || !faceInfo) {
        return;
      }

      // Drill Logic
      if (transformMode === "drill") {
        drillTool.handleDrillClick(faceInfo);
        return;
      }

      // Ruler Logic
      if (transformMode === "ruler") {
        rulerTool.handleRulerPick(faceInfo);
        return;
      }

      // Alignment Logic
      transformTool.handleAlignmentPick(faceInfo);
    },
    [transformMode, alignEnabled, cutTool, drillTool, rulerTool, transformTool]
  );

  // Selection Wrapper to handle side effects
  const handleSelect = useCallback((id, multi = false) => {
    if (id === null) {
      selectionTool.select(null);
      // Clear side effects
      transformTool.setPendingAlignFace(null);
      if (transformMode !== 'ruler' && transformMode !== 'drill') {
        setHudState(null);
      }
      if (transformMode === "ruler") {
        setRulerPoints([]); // Directly set store
      }
      return;
    }

    // Tool Mode Logic
    if (transformMode === 'connect' || transformMode === 'subtract' || transformMode === 'union') {
        setSelectedIds(prev => {
            // Union: Unlimited, just toggle/add
            if (transformMode === 'union') {
                if (prev.includes(id)) return prev.filter(pid => pid !== id);
                return [...prev, id];
            }
            
            // Connect/Subtract: Max 2
            if (prev.includes(id)) return prev; // Don't toggle off for now, or maybe allow deselect? Let's keep simple.
            
            if (prev.length < 2) return [...prev, id];
            // If already 2, replace the second one
            return [prev[0], id];
        });
        
        // Update HUD state immediately
        // Note: we need the NEW selectedIds, but setState is async. 
        // We can just rely on the HUD component observing selectedIds.
        return;
    }

    selectionTool.select(id, multi);

    // Update HUD for single selection
    if (!multi) {
      const obj = objects.find(o => o.id === id);
      if (obj) {
        if (transformMode === 'translate') {
          setHudState({
            type: 'move', data: {
              x: obj.pos[0], y: obj.pos[1], z: obj.pos[2]
            }
          });
        } else if (transformMode === 'rotate') {
          setHudState({
            type: 'rotate', data: {
              rx: THREE.MathUtils.radToDeg(obj.rot[0]),
              ry: THREE.MathUtils.radToDeg(obj.rot[1]),
              rz: THREE.MathUtils.radToDeg(obj.rot[2])
            }
          });
        } else if (transformMode === 'scale') {
          const s = obj.scale || [1, 1, 1];
          setHudState({
            type: 'scale', data: {
              sx: s[0], sy: s[1], sz: s[2], factor: s[0]
            }
          });
        } else if (transformMode === 'modify') {
            setHudState(prev => {
                const currentEdges = (prev?.type === 'modify' && prev?.data?.partId === obj.id) 
                    ? (prev.data.edges || []) 
                    : [];
                
                return {
                    type: 'modify',
                    data: {
                        partId: obj.id,
                        edges: currentEdges,
                        operation: 'chamfer',
                        size: 5
                    }
                };
            });
        }
      }
    }
  }, [selectionTool, transformTool, transformMode, setHudState, setRulerPoints, objects]);

  // --- Import / Export ---
  const handleExport = () => {
    const dataStr = JSON.stringify(objects, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `pc-case-design-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleImport = (file) => {
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".json")) {
      reader.onload = (e) => {
        try {
          const importedObjects = JSON.parse(e.target.result);
          if (Array.isArray(importedObjects)) {
            const normalizedObjects = importedObjects.map((obj) => ({
              ...obj,
              connectors: Array.isArray(obj?.connectors) ? obj.connectors : [],
            }));
            setObjects(normalizedObjects);
            setSelectedIds([]);
            alert(`Successfully imported ${importedObjects.length} objects!`);
          } else {
            throw new Error("Invalid file format: not an array.");
          }
        } catch (error) {
          alert(`Import failed: ${error.message}`);
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith(".stl")) {
      reader.onload = (e) => {
        try {
          const contents = e.target.result; // ArrayBuffer
          const loader = new STLLoader();
          const geometry = loader.parse(contents);
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);

          const newObject = {
            id: `imported_${Date.now()}`,
            type: "imported",
            name: file.name.replace(/\.stl$/i, ""),
            pos: [0, 0, size.y / 2],
            rot: [0, 0, 0],
            dims: { w: size.x, h: size.y, d: size.z },
            visible: true,
            includeInExport: true,
            meta: { geometryBase64: arrayBufferToBase64(contents) },
          };
          setObjects((prev) => [...prev, newObject]);
          setSelectedIds([newObject.id]);
        } catch (error) {
          alert(`Failed to import STL file: ${error.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Unsupported file type. Please choose a .json or .stl file.");
    }
  };

  // Ensure connectors valid
  useEffect(() => {
    const { objects: hydratedObjects, changed } = ensureSceneConnectors(objects);
    if (changed) {
      setObjects(hydratedObjects, { recordHistory: false });
    }
  }, [objects, setObjects]);





// ...

  const handleModifyPick = useCallback((pickData) => {
    console.log('[PCEditor] handleModifyPick Called:', pickData); // DEBUG LOG
    setHudState(current => {
        const next = reduceModifyState(current, pickData);
        console.log('[PCEditor] Next HUD State:', next); // DEBUG LOG
        return next;
    });
  }, [setHudState]);

  useEffect(() => {
      if (hudState?.type === 'modify') {
          console.log('[PCEditor] hudState updated:', hudState);
      }
  }, [hudState]);

  const modifySelection = useMemo(() => {
     if (hudState?.type === 'modify' && hudState.data?.partId) {
         return {
             partId: hudState.data.partId,
             edges: hudState.data.edges || (hudState.data.edge ? [hudState.data.edge] : [])
         };
     }
     return null;
  }, [hudState]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Top Bar */}
      <TopBar
        onImport={handleImport}
        onExport={handleExport}
        undo={undo}
        redo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        transformMode={transformMode}
        setTransformMode={handleTransformModeChange}
        showGrid={showHorizontalGrid}
        setShowGrid={setShowHorizontalGrid}
        showGizmos={showGizmos}
        setShowGizmos={setShowGizmos}
        measurements={measurements}
        onClearMeasurements={rulerTool.clearMeasurements}
        onOpenProjectManager={() => setActiveLeftTab("projects")}
        currentProjectName={currentProjectName}
        onGenerateStandoffs={drillTool.handleGenerateStandoffs}
        onConnect={() => {
          if (connectorTool.activeConnectorId) {
            connectorTool.setActiveConnectorId(null);
          }
        }}
        onToggleCut={cutTool.handleToggleCutMode}
        isCutting={transformMode === 'cut'}
        selectedObject={selectedObject}
        selectedIds={selectedIds}
      />
      <HUD 
        transformMode={transformMode} 
        onApplyCut={cutTool.performSplit} 
        onConnect={connectorTool.handleConnect}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Left Sidebar */}
        <LeftSidebar
          objects={objects}
          setObjects={setObjects}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onGroup={selectionTool.handleGroup}
          onUngroup={selectionTool.handleUngroup}
          onDuplicate={selectionTool.handleDuplicate}
          activeTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
        />

        {/* Main Viewport */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <Scene
            objects={expandedObjects}
            setObjects={setObjects}
            drillParams={drillParams}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            connections={connections}
            showHorizontalGrid={showHorizontalGrid}
            alignMode={alignEnabled}
            onFacePick={handleFacePick}
            onDrillHover={drillTool.handleDrillHover}
            onConnectorPick={connectorTool.handleConnectorPick}
            onModifyPick={handleModifyPick}
            modifySelection={modifySelection}
            activeAlignFace={transformMode === 'ruler' ? rulerTool.startFace : transformTool.pendingAlignFace}
            transformMode={transformMode}
            onChangeTransformMode={handleTransformModeChange}
            showTransformControls={showGizmos}
            measurements={measurements}
            drillGhost={drillTool.drillGhost}
            drillCandidates={drillTool.drillCandidates}
            onHoleDelete={drillTool.handleHoleDelete}
            rulerPoints={rulerPoints}
            cutterFace={cutTool.cutterFace}
            isCutting={transformMode === 'cut'}
            drillDebugIds={drillTool.drillDebugIds}
          />
        </div>

        {/* Right Sidebar */}
        {selectedObject && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 10, height: "100%" }}>
            <RightSidebar
              selectedObject={selectedObject}
              selectedIds={selectedIds}
              objects={objects}
              setObjects={setObjects}
              connections={connections}
              activeConnectorId={connectorTool.activeConnectorId}
              setActiveConnectorId={connectorTool.setActiveConnectorId}
              onApplyConnectorOrientation={connectorTool.handleApplyConnectorOrientation}
              onGroup={selectionTool.handleGroup}
              onUngroup={selectionTool.handleUngroup}
              onDuplicate={selectionTool.handleDuplicate}
              onDelete={selectionTool.handleDelete}
              onConnect={connectorTool.handleConnect}
            />
          </div>
        )}

        <ConnectorToast />
      </div>
    </div>
  );
}

export default function PCEditor() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <EditorContent />
      </ToastProvider>
    </LanguageProvider>
  );
}
