import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useLanguage } from '../../i18n/LanguageContext';
import * as THREE from 'three';

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

const NumberInput = ({ value, onCommit, suffix = '', width = 60 }) => {
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
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        style={{ ...inputStyle, width }}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {suffix && <span style={{ ...labelStyle, marginLeft: 2 }}>{suffix}</span>}
    </div>
  );
};

const HUD = ({ transformMode }) => {
  const hudState = useStore(state => state.hudState);
  const setObjects = useStore(state => state.setObjects);
  const selectedIds = useStore(state => state.selectedIds);
  const objects = useStore(state => state.objects);
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
    switch (type) {
      case 'move':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>X</span>
              <NumberInput
                value={data.x}
                onCommit={(val) => updateSingleAxis('pos', 0, val)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput
                value={data.y}
                onCommit={(val) => updateSingleAxis('pos', 1, val)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
              <NumberInput
                value={data.z}
                onCommit={(val) => updateSingleAxis('pos', 2, val)}
              />
            </div>
          </>
        );

      case 'rotate':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>RX</span>
              <NumberInput
                value={data.rx}
                suffix="°"
                onCommit={(val) => updateSingleAxis('rot', 0, THREE.MathUtils.degToRad(val))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>RY</span>
              <NumberInput
                value={data.ry}
                suffix="°"
                onCommit={(val) => updateSingleAxis('rot', 1, THREE.MathUtils.degToRad(val))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>RZ</span>
              <NumberInput
                value={data.rz}
                suffix="°"
                onCommit={(val) => updateSingleAxis('rot', 2, THREE.MathUtils.degToRad(val))}
              />
            </div>
          </>
        );

      case 'scale':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>X</span>
              <NumberInput 
                value={data.sx ?? data.factor ?? 1} 
                suffix="x"
                onCommit={(val) => updateSingleAxis('scale', 0, val)} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput 
                value={data.sy ?? data.factor ?? 1} 
                suffix="x"
                onCommit={(val) => updateSingleAxis('scale', 1, val)} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
              <NumberInput 
                value={data.sz ?? data.factor ?? 1} 
                suffix="x"
                onCommit={(val) => updateSingleAxis('scale', 2, val)} 
              />
            </div>
          </>
        );

      case 'ruler':
        const step1Filled = rulerPoints.length >= 1;
        const step2Filled = rulerPoints.length >= 2;
        
        let displayDistance = '0.00';
        if (step2Filled && rulerPoints[0] && rulerPoints[1]) {
            displayDistance = rulerPoints[0].distanceTo(rulerPoints[1]).toFixed(2);
        }
        
        const Box = ({ filled }) => (
          <div style={{
            width: 10, height: 10,
            border: '1px solid #94a3b8',
            background: filled ? '#3b82f6' : 'transparent',
            marginLeft: 8,
            borderRadius: 2
          }} />
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
             <div style={{ display: 'flex', alignItems: 'center', opacity: step1Filled ? 0.5 : 1 }}>
                <span style={{...labelStyle, marginRight: 0}}>{t('label.selectFace1')}</span>
                <Box filled={step1Filled} />
             </div>
             <div style={{ display: 'flex', alignItems: 'center', opacity: step2Filled ? 0.5 : (step1Filled ? 1 : 0.5) }}>
                <span style={{...labelStyle, marginRight: 0}}>{t('label.selectFace2')}</span>
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

      case 'drill':
        const updateParam = (key, val) => setDrillParams({ [key]: val });
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            
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
            
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, borderTop: '1px solid #334155', paddingTop: 4, width: '100%', textAlign: 'center' }}>
              {t('label.drillInstructions')}
            </div>
          </div>
        );

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
