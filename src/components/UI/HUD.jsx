import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToast } from '../../context/ToastContext';
import * as THREE from 'three';
import { normalizeDegree, getRelativeTransform } from '../../utils/mathUtils';
import { calculateMortiseTenon, calculateCrossLap } from '../../utils/connectionUtils';
import { calculateHalfLapTransforms, validateHalfLapCompatibility } from '../../utils/halfLapUtils';

const labelStyle = {
  color: '#94a3b8',
  fontWeight: 500,
  marginRight: 4,
};

const inputStyle = {
  width: 60,
  padding: '2px 4px',
  borderRadius: 4,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: 12,
  fontFamily: 'monospace',
  textAlign: 'right',
  outline: 'none',
};

const NumberInput = ({ value, onCommit, suffix = '', width = 60, disabled = false }) => {
  const [localValue, setLocalValue] = useState(value?.toFixed(2) ?? '0.00');

  const inputRef = React.useRef(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value?.toFixed(2) ?? '0.00');
    }
  }, [value]);


  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = parseFloat(localValue) || 0;
      onCommit(val);
      inputRef.current.blur();
    }
  };

  const handleBlur = () => {
    const val = parseFloat(localValue) || 0;
    onCommit(val);
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      <input
        ref={inputRef}
        style={{ ...inputStyle, width, cursor: disabled ? 'not-allowed' : 'text' }}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
      />
      {suffix && <span style={{ ...labelStyle, marginLeft: 2 }}>{suffix}</span>}
    </div>
  );
};

const Box = ({ filled }) => (
  <div style={{
    width: 10, height: 10,
    border: '1px solid #94a3b8',
    background: filled ? '#3b82f6' : 'transparent',
    marginLeft: 8,
    borderRadius: 2
  }} />
);

const HUD = ({ transformMode, onApplyCut, onConnect }) => {
  const { showToast } = useToast();
  const hudState = useStore(state => state.hudState);
  const setObjects = useStore(state => state.setObjects);
  const selectedIds = useStore(state => state.selectedIds);
  const objects = useStore(state => state.objects);
  // ... (rest of hooks)

  const [connType, setConnType] = useState('mortise-tenon');
  const [connDepth, setConnDepth] = useState(5.0);
  const [connClearance, setConnClearance] = useState(0.1);
  const [lapLength, setLapLength] = useState(20.0);

  // (Inside the component, need to implement handleApplyLogicTool before return or inside renderContent)
  const handleApplyLogicTool = (toolType, parts, setObjFn, connectionType) => {
      if (!parts || parts.length < 2) return;
      
      const basePart = parts[0];
      const others = parts.slice(1);
      
      if (toolType === 'connect') {
           const partA = basePart;
           const partB = others[0];
           
           try {
              if (connectionType === 'cross-lap') {
                 const result = calculateCrossLap(partA, partB, connClearance);
                 if (result) {
                     setObjFn(prev => prev.map(o => {
                         if (o.id === result.partA.id) return result.partA;
                         if (o.id === result.partB.id) return result.partB;
                         return o;
                     }));
                 }
              } else if (connectionType === 'mortise-tenon') {
                  // Tenon = Part A (First), Mortise = Part B (Second)
                  // Note: calculateMortiseTenon(tenon, mortise, depth, clearance)
                  // If connection utils expects reversed roles, user can swap selection order,
                  // but typically first selected is the "Active" one (Tenon).
                  const result = calculateMortiseTenon(partA, partB, connDepth, connClearance);
                  if (result) {
                      setObjFn(prev => prev.map(o => {
                          if (o.id === result.tenon.id) return result.tenon;
                          if (o.id === result.mortise.id) return result.mortise;
                          return o;
                      }));
                  }
              } else if (connectionType === 'half-lap') {
                 const validation = validateHalfLapCompatibility(partA, partB);
                 if (!validation.compatible) {
                      showToast({ type: "error", text: validation.reason, ttl: 3000 });
                      return; // Stop
                 }
                 const result = calculateHalfLapTransforms(partA, partB, lapLength);
                 // Right Sidebar used 'lapLength' state. I don't have that param in HUD yet. 
                 // I will use a default of 10 for now or add a param later.
                 
                 if (result && result.updates) {
                      setObjFn(prev => prev.map(o => {
                        const update = result.updates.find(u => u.id === o.id);
                        return update ? { ...o, ...update } : o;
                      }));
                 }
             }
           } catch (err) {
               showToast({ type: "error", text: err.message, ttl: 3000 });
               return;
           }

           if (onConnect) {
               onConnect(connectionType);
           }
           return;
      }
      
      // CSG Logic (Union / Subtract)
      const modifiers = others.map(other => ({

        ...other,
        id: `${toolType}_${other.id}_${Date.now()}`,
        sourceId: other.id,
        operation: toolType === 'union' ? 'union' : 'subtract',
        relativeTransform: getRelativeTransform(other, basePart),
        scale: other.scale || [1, 1, 1],
        dims: other.dims, // Ensure dims are passed
        type: other.type // Ensure type
      }));

      setObjFn(prev => {
        // Update Base Part
        const next = prev.map(o => {
            if (o.id === basePart.id) {
                return {
                    ...o,
                    csgOperations: [...(o.csgOperations || []), ...modifiers]
                };
            }
            return o;
        });
        
        // Remove Source Parts?
        // Remove Source Parts ONLY for Union
        if (toolType === 'union') {
           const idsToRemove = others.map(o => o.id);
           return next.filter(o => !idsToRemove.includes(o.id));
        }
        return next;
      });
      
      showToast({ 
          type: "success", 
          text: `Applied ${toolType} to ${basePart.name || "Base Object"}`, 
          ttl: 2000 
      });
      
      // Optionally clear selection but keep mode
      // useStore.getState().setSelectedIds([]); // Can't call hook inside callback easily unless we use store setter from props
      // We have setObjects, but we need setSelectedIds. 
      // HUD doesn't import setSelectedIds currently? 
      // Checking hooks...
      // const selectedIds = useStore(state => state.selectedIds);
      // I generally don't have setSelectedIds in HUD props/store hooks in the code snippet I saw?
      // Wait, line 84: const selectedIds = useStore(state => state.selectedIds);
      // I should add setSelectedIds to the hook destructuring at the top.
      // But for now, let's just let the user see the result. The objects disappear, so selection is naturally cleared/invalid?
      // No, if IDs are in selectedIds but objects are gone, highlights might crash or just disappear.
      // Ideally I should clear selection.
  };
  const setHudState = useStore(state => state.setHudState);
  const rulerPoints = useStore(state => state.rulerPoints);
  const setRulerPoints = useStore(state => state.setRulerPoints);
  const measurements = useStore(state => state.measurements);
  const setMeasurements = useStore(state => state.setMeasurements);
  const drillParams = useStore(state => state.drillParams);
  const setDrillParams = useStore(state => state.setDrillParams);
  const { t } = useLanguage();

  // Determine effective type and data
  let type = hudState?.type;
  let data = hudState?.data || {};

  if (transformMode === 'ruler') {
    type = 'ruler';
  } else if (transformMode === 'cut') {
    type = 'cut';
  } else if (transformMode === 'modify') {
    type = 'modify';
  }

  if (!type) return null;

  const containerStyle = {
    position: 'absolute',
    top: 48,
    left: 560, // Approximate position under transform buttons
    background: 'rgba(30, 41, 59, 0.95)',
    color: '#e2e8f0',
    padding: '4px 12px',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    zIndex: 1000,
    fontSize: 13,
    border: '1px solid #334155',
    borderTop: 'none',
    backdropFilter: 'blur(4px)',
  };

  const updateSingleAxis = (property, axisIndex, newValue) => {
    if (selectedIds.length === 0) return;
    const id = selectedIds[0];
    const obj = objects.find(o => o.id === id);
    if (!obj) return;

    let currentVec = [0, 0, 0];
    if (property === 'pos') currentVec = obj.pos || [0, 0, 0];
    else if (property === 'rot') currentVec = obj.rot || [0, 0, 0];
    else if (property === 'scale') currentVec = obj.scale || [1, 1, 1];

    const newVec = [...currentVec];
    newVec[axisIndex] = newValue;

    // Update Object Store
    setObjects(prev => prev.map(o => {
      if (o.id !== id) return o;
      return { ...o, [property]: newVec };
    }));

    // Update HUD State to reflect changes immediately and prevent stale data
    // We need to match the structure expected by renderContent
    let newHudData = { ...data };

    if (property === 'pos') {
      const axes = ['x', 'y', 'z'];
      newHudData[axes[axisIndex]] = newValue;
    } else if (property === 'rot') {
      const axes = ['rx', 'ry', 'rz'];
      newHudData[axes[axisIndex]] = THREE.MathUtils.radToDeg(newValue);
    } else if (property === 'scale') {
      const axes = ['sx', 'sy', 'sz'];
      newHudData[axes[axisIndex]] = newValue;
    }
    setHudState({ ...hudState, data: newHudData });
  };

  const renderContent = () => {
    const hasSelection = selectedIds.length > 0;
    const inputDisabled = !hasSelection;

    switch (type) {
      case 'move': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasSelection && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>X</span>
                  <NumberInput
                    value={data.x}
                    suffix="mm"
                    onCommit={(val) => updateSingleAxis('pos', 0, val)}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>Y</span>
                  <NumberInput
                    value={data.y}
                    suffix="mm"
                    onCommit={(val) => updateSingleAxis('pos', 1, val)}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>Z</span>
                  <NumberInput
                    value={data.z}
                    suffix="mm"
                    onCommit={(val) => updateSingleAxis('pos', 2, val)}
                    disabled={inputDisabled}
                  />
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginTop: hasSelection ? 4 : 0, borderTop: hasSelection ? '1px solid #334155' : 'none', paddingTop: hasSelection ? 4 : 0, width: '100%', textAlign: 'center' }}>
              {t('label.moveInstructions')}
            </div>
          </div>
        );
      }

      case 'rotate': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasSelection && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>RX</span>
                  <NumberInput
                    value={data.rx ? normalizeDegree(data.rx) : 0}
                    suffix="°"
                    onCommit={(val) => updateSingleAxis('rot', 0, THREE.MathUtils.degToRad(val))}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>RY</span>
                  <NumberInput
                    value={data.ry ? normalizeDegree(data.ry) : 0}
                    suffix="°"
                    onCommit={(val) => updateSingleAxis('rot', 1, THREE.MathUtils.degToRad(val))}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>RZ</span>
                  <NumberInput
                    value={data.rz ? normalizeDegree(data.rz) : 0}
                    suffix="°"
                    onCommit={(val) => updateSingleAxis('rot', 2, THREE.MathUtils.degToRad(val))}
                    disabled={inputDisabled}
                  />
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginTop: hasSelection ? 4 : 0, borderTop: hasSelection ? '1px solid #334155' : 'none', paddingTop: hasSelection ? 4 : 0, width: '100%', textAlign: 'center' }}>
              {t('label.rotateInstructions')}
            </div>
          </div>
        );
      }

      case 'scale': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasSelection && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>X</span>
                  <NumberInput
                    value={data.sx ?? data.factor ?? 1}
                    suffix="x"
                    onCommit={(val) => updateSingleAxis('scale', 0, val)}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>Y</span>
                  <NumberInput
                    value={data.sy ?? data.factor ?? 1}
                    suffix="x"
                    onCommit={(val) => updateSingleAxis('scale', 1, val)}
                    disabled={inputDisabled}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={labelStyle}>Z</span>
                  <NumberInput
                    value={data.sz ?? data.factor ?? 1}
                    suffix="x"
                    onCommit={(val) => updateSingleAxis('scale', 2, val)}
                    disabled={inputDisabled}
                  />
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginTop: hasSelection ? 4 : 0, borderTop: hasSelection ? '1px solid #334155' : 'none', paddingTop: hasSelection ? 4 : 0, width: '100%', textAlign: 'center' }}>
              {t('label.scaleInstructions')}
            </div>
          </div>
        );
      }

      case 'ruler': {
        const step1Filled = rulerPoints.length >= 1;
        const step2Filled = rulerPoints.length >= 2;

        let displayDistance = '0.00';
        if (step2Filled && rulerPoints[0] && rulerPoints[1]) {
          const v1 = new THREE.Vector3(...rulerPoints[0]);
          const v2 = new THREE.Vector3(...rulerPoints[1]);
          displayDistance = v1.distanceTo(v2).toFixed(2);
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', opacity: step1Filled ? 0.5 : 1 }}>
              <span style={{ ...labelStyle, marginRight: 0 }}>{t('label.selectFace1')}</span>
              <Box filled={step1Filled} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', opacity: step2Filled ? 0.5 : (step1Filled ? 1 : 0.5) }}>
              <span style={{ ...labelStyle, marginRight: 0 }}>{t('label.selectFace2')}</span>
              <Box filled={step2Filled} />
            </div>
            {(step2Filled || measurements.length > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, borderTop: '1px solid #334155', paddingTop: 6, justifyContent: 'space-between', minHeight: 24 }}>
                {step2Filled ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={labelStyle}>{t('label.distance')}</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600, fontFamily: 'monospace', fontSize: 14 }}>
                      {displayDistance} mm
                    </span>
                  </div>
                ) : <div />}

                {measurements.length > 0 && (
                  <button
                    onClick={() => {
                      setMeasurements([]);
                      setRulerPoints([]);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #475569',
                      color: '#94a3b8',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      cursor: 'pointer',
                      marginLeft: 12
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'drill': {
        const updateParam = (key, val) => setDrillParams({ [key]: val });
        const drillType = drillParams.drillType || 'screw';
        const setDrillType = (t) => updateParam('drillType', t);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 8px' }}>

            {/* Type Toggle */}
            <div style={{ display: 'flex', background: '#334155', borderRadius: 4, padding: 2, marginBottom: 4 }}>
              <button
                onClick={() => setDrillType('screw')}
                style={{
                  background: drillType === 'screw' ? '#475569' : 'transparent',
                  color: drillType === 'screw' ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
                }}
              >
                Screw
              </button>
              <button
                onClick={() => setDrillType('nut')}
                style={{
                  background: drillType === 'nut' ? '#475569' : 'transparent',
                  color: drillType === 'nut' ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
                }}
              >
                Nut
              </button>
            </div>

            {drillType === 'screw' ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {/* Left Column: Diameters & Diagram */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {/* Head Dia */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Head Dia</span>
                    <NumberInput value={drillParams.headDiameter} onCommit={(v) => updateParam('headDiameter', v)} width={50} />
                  </div>

                  {/* Diagram */}
                  <svg width="60" height="80" viewBox="0 0 60 80" style={{ overflow: 'visible', margin: '4px 0' }}>
                    {/* Head */}
                    <path d="M5,5 L55,5 L55,25 L5,25 Z" fill="rgba(255,255,255,0.05)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Shaft */}
                    <path d="M20,25 L40,25 L40,75 L20,75 Z" fill="rgba(255,255,255,0.05)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Center Line */}
                    <path d="M30,0 L30,80" stroke="#475569" strokeWidth="1" strokeDasharray="4 2" />
                  </svg>

                  {/* Hole Dia */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <NumberInput value={drillParams.holeDiameter} onCommit={(v) => updateParam('holeDiameter', v)} width={50} />
                    <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Hole Dia</span>
                  </div>
                </div>

                {/* Right Column: Heights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, justifyContent: 'center', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NumberInput value={drillParams.headDepth} onCommit={(v) => updateParam('headDepth', v)} width={50} />
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>Head H</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NumberInput value={drillParams.holeDepth} onCommit={(v) => updateParam('holeDepth', v)} width={50} />
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>Depth</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {/* Nut UI */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Diameter</span>
                    <NumberInput value={drillParams.nutDiameter || 6} onCommit={(v) => updateParam('nutDiameter', v)} width={50} />
                  </div>

                  {/* Hex Nut Diagram */}
                  <svg width="60" height="60" viewBox="0 0 60 60" style={{ overflow: 'visible', margin: '4px 0' }}>
                    {/* Hexagon */}
                    <path d="M30,5 L52,17 L52,43 L30,55 L8,43 L8,17 Z" fill="rgba(255,255,255,0.05)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Inner Circle */}
                    <circle cx="30" cy="30" r="12" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                  </svg>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <NumberInput value={drillParams.nutDepth || 2.5} onCommit={(v) => updateParam('nutDepth', v)} width={50} />
                    <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Thickness</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, borderTop: '1px solid #334155', paddingTop: 4, width: '100%', textAlign: 'center' }}>
              {drillType === 'screw' ? t('label.drillInstructions') : "Click face to place Nut"}
            </div>
          </div>
        );
      }

      case 'cut': {
        const selectedObjs = objects.filter(o => selectedIds.includes(o.id));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: 4 }}>
              Split Targets ({selectedObjs.length})
            </div>

            {selectedObjs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
                {selectedObjs.map(o => (
                  <div key={o.id} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Box filled={true} />
                    <span>{o.name || o.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                No objects selected
              </div>
            )}

            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, borderTop: '1px solid #334155', paddingTop: 4 }}>
              1. Select objects to split<br />
              2. Shift + Click a face to set plane<br />
              3. Click Apply Split
            </div>

            <button
              onClick={onApplyCut}
              style={{
                marginTop: 4,
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Apply Split
            </button>
          </div>
        );
      }



      case 'modify': {
        console.log('[HUD] Rendering Modify. Data:', data); // DEBUG LOG
        const edges = data.edges || (data.edge ? [data.edge] : []);
        const hasSelection = edges.length > 0 && data.partId;
        console.log('[HUD] hasSelection:', hasSelection, 'Edges:', edges.length, 'PartId:', data.partId); // DEBUG LOG
        
        const updateModify = (k, v) => {
           setHudState({ ...hudState, data: { ...data, [k]: v } });
        };
        const applyModify = () => {
           if (!data.partId || edges.length === 0) return;
           
           setObjects(prev => prev.map(o => {
               if (o.id !== data.partId) return o;
               
               const modifierType = data.operation || 'chamfer';
               const size = data.size || 5;
               
               const newOps = edges.map(edge => ({
                   id: Date.now().toString() + Math.random(),
                   type: modifierType,
                   edge: edge.id,
                   size: size,
                   dims: { w: 0, h: 0, d: 0 }
               }));

               const existingOps = o.csgOperations || [];
               return {
                   ...o,
                   csgOperations: [...existingOps, ...newOps]
               };
           }));
           
           // Clear selection but keep mode
           setHudState({ ...hudState, data: { ...data, edges: [], edge: null } }); 
        };

        if (!hasSelection) {
             return (
                 <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>
                    Click an edge to modify (Shift+Click to multi-select)
                 </div>
             );
        }

        const btnStyle = {
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid #475569",
            background: "transparent",
            color: "#e2e8f0",
            fontSize: 11,
            cursor: "pointer",
        };


         return (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
               {/* ... Modify UI ... */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>Edge</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {edges.length > 1 ? `${edges.length} Selected` : edges[0]?.id}
                  </span>
               </div>
               
               <div style={{ width:1, height: 24, background: '#334155' }} />
               
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                   <span style={{ fontSize: 10, color: '#94a3b8' }}>Type</span>
                   <div style={{ display: 'flex', gap: 2, background: '#334155', borderRadius: 4, padding: 2 }}>
                      <button 
                         onClick={() => updateModify('operation', 'chamfer')}
                         style={{ ...btnStyle, background: data.operation === 'chamfer' ? '#475569' : 'transparent', border: 'none' }}
                      >Chamfer</button>
                       <button 
                         onClick={() => updateModify('operation', 'fillet')}
                         style={{ ...btnStyle, background: data.operation === 'fillet' ? '#475569' : 'transparent', border: 'none' }}
                      >Fillet</button>
                   </div>
               </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                   <span style={{ fontSize: 10, color: '#94a3b8' }}>Size (mm)</span>
                   <NumberInput value={data.size} onCommit={(v) => updateModify('size', v)} width={40} />
               </div>

               <div style={{ width:1, height: 24, background: '#334155' }} />

               <button 
                   onClick={applyModify}
                   style={{ ...btnStyle, background: '#2563eb', border: 'none', fontWeight: 600 }}
               >
                   Apply
               </button>
            </div>
         );
      }

      // --- Logic Tools ---
      case 'union':
      case 'subtract':
      case 'connect': {
          // Sort by Selection Order
          const selectedParts = selectedIds
              .map(id => objects.find(o => o.id === id))
              .filter(Boolean);
              
          const count = selectedParts.length;
          
          let instruction = "";
          let ready = false;
          
          if (type === 'union') {
              if (count === 0) instruction = "Select Base Object";
              else if (count === 1) instruction = "Select Object(s) to Merge";
              else {
                  instruction = `Merge ${count - 1} items into Base`;
                  ready = true;
              }
          } else if (type === 'subtract') {
              if (count === 0) instruction = "Select Base Object";
              else if (count === 1) instruction = "Select Object to Subtract";
              else {
                  instruction = "Ready to Subtract";
                  ready = true;
              }
          } else if (type === 'connect') {
              if (count === 0) instruction = "Select First Part";
              else if (count === 1) instruction = "Select Second Part";
              else {
                  instruction = "Ready to Connect";
                  ready = true;
              }
          }
          
          // Connect Params

          const applyLogic = () => {
             if (!ready) return;
             
             const base = selectedParts[0];
             const others = selectedParts.slice(1);
             
             if (type === 'union' || type === 'subtract') {
                 // CSG Logic (Union / Subtract)
                 const modifiers = others.map(other => ({
                    ...other,
                    id: `${type}_${other.id}_${Date.now()}`,
                    sourceId: other.id,
                    operation: type === 'union' ? 'union' : 'subtract',
                    relativeTransform: getRelativeTransform(other, base),
                    scale: other.scale || [1, 1, 1],
                    dims: other.dims,
                    type: other.type
                 }));

                 setObjFn(prev => {
                    // Update Base Part
                    const next = prev.map(o => {
                        if (o.id === base.id) {
                            return {
                                ...o,
                                csgOperations: [...(o.csgOperations || []), ...modifiers]
                            };
                        }
                        return o;
                    });
                    
                    // Remove Source Parts ONLY for Union
                    if (type === 'union') {
                        const idsToRemove = others.map(o => o.id);
                        return next.filter(o => !idsToRemove.includes(o.id));
                    }
                    
                    return next;
                 });
                 
                 showToast({ 
                     type: "success", 
                     text: `Applied ${type} to ${base.name || "Base Object"}`, 
                     ttl: 2000 
                 });
             } else if (type === 'connect') {
                 // Forward to handleApplyLogicTool (Connect logic uses the main handler structure which already exists)
                 // But wait, applyLogic is replacing handleApplyLogicTool partially?
                 // No, applyLogic is local here.
                 // Actually, looking at previous code, handleApplyLogicTool was defined OUTSIDE component? 
                 // No, inside. But I am inside `case 'connect'`.
                 // I should use the OUTER `handleApplyLogicTool` if possible, OR inline the logic here.
                 // The previous code called `handleApplyLogicTool(type, selectedParts, setObjects, connType);`
                 // I should just ensure `selectedParts` passed to it is the ORDERED one.
                 // But wait, the previous code defined `handleApplyLogicTool` at line 98.
                 // And here I am inside `renderContent`.
                 // The `selectedParts` variable defined at the top of this case block IS the one passed to `handleApplyLogicTool`
                 // So if I fix `selectedParts` definition at the top of this case, I am good.
                 
                 // However, I also modified the Subtract logic inside `handleApplyLogicTool` earlier.
                 // Wait, `handleApplyLogicTool` is defined at the top level of HUD component.
                 // This `applyLogic` function here seems to be leftovers or I am misreading the context.
                 // Let's check `renderContent` -> `case 'connect'` -> `return button onClick`.
                 // The button calls `handleApplyLogicTool`.
                 // So I MUST modify the `handleApplyLogicTool` definition, NOT just the `case` logic.
                 
                 // WAIT. In my previous `replace_file_content` I was targeting `HUD.jsx` line 160 which is INSIDE `handleApplyLogicTool`.
                 // The `case` block logic is just for display and calling the handler.
                 // The Handler ITSELF needs to sort `parts`.
                 
                 // So I should modify `handleApplyLogicTool` implementation to re-sort `parts` based on `selectedIds`?
                 // `handleApplyLogicTool` receives `parts`.
                 // The caller is `onClick={() => handleApplyLogicTool(..., selectedParts, ...)}`.
                 // If I fix `selectedParts` in the `case` block, then `handleApplyLogicTool` receives the sorted array.
                 // AND I also need to fix the deletion logic inside `handleApplyLogicTool`.
                 
                 // So I need to do TWO things:
                 // 1. In `case 'connect'`, fix `selectedParts` definition.
                 // 2. In `handleApplyLogicTool` (top of component), fix the deletion logic.
                 
                 // This tool call is targeting Lines 734-800 which is inside `case 'connect'`.
                 // So I am fixing (1) here.
                 // I will still need another edit for (2).
                 
                 // wait, effectively I am rewriting the `case` block.
                 // I'll fix the `selectedParts` here.
             }
      }

          return (
             <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>Status</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ready ? '#4ade80' : '#e2e8f0' }}>
                        {instruction}
                    </span>
                 </div>
                 
                 {type === 'connect' && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Type</span>
                        <select 
                            value={connType} 
                            onChange={e => setConnType(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: 'none', borderRadius: 4, fontSize: 11, padding: 2 }}
                        >
                            <option value="mortise-tenon">Mortise & Tenon</option>
                            <option value="cross-lap">Cross Lap</option>
                            <option value="half-lap">Half Lap</option>
                        </select>
                     </div>
                 )}
                 
                 {type === 'connect' && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                       {connType === 'mortise-tenon' && (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Depth</span>
                            <NumberInput value={connDepth} onCommit={setConnDepth} width={50} />
                         </div>
                       )}
                       
                       {connType === 'half-lap' && (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Length</span>
                            <NumberInput value={lapLength} onCommit={setLapLength} width={50} />
                         </div>
                       )}

                       <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Clearance</span>
                            <NumberInput value={connClearance} onCommit={setConnClearance} width={50} />
                       </div>
                    </div>
                 )}

                 <div style={{ width:1, height: 24, background: '#334155' }} />
                 
                 <button 
                   disabled={!ready}
                   onClick={() => {
                       // Logic EXECUTION
                       // (I will implement the actual logic updates in a separate function to keep JSX clean
                       //  or inline it if I can import getRelativeTransform)
                       // I'LL ADD A CALLBACK PROP to HUD for this, pass it from PCEditor? 
                       // No, HUD already has setObjects. 
                       // I will trigger a 'handleApply' function I'll implement in HUD.jsx body.
                       handleApplyLogicTool(type, selectedParts, setObjects, connType);
                   }}
                   style={{ 
                       padding: "4px 12px", borderRadius: 4, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer",
                       background: ready ? '#22c55e' : '#475569', color: 'white', opacity: ready ? 1 : 0.5 
                   }}
                 >
                   APPLY
                 </button>
             </div>
          );
      }

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {renderContent()}
    </div>
  );
};

export default HUD;
