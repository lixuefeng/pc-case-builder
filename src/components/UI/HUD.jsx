import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
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

const NumberInput = ({ value, onCommit, suffix = '' }) => {
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
        style={inputStyle}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {suffix && <span style={{ ...labelStyle, marginLeft: 2 }}>{suffix}</span>}
    </div>
  );
};

const HUD = () => {
  const hudState = useStore(state => state.hudState);
  const setObjects = useStore(state => state.setObjects);
  const selectedIds = useStore(state => state.selectedIds);
  const objects = useStore(state => state.objects);
  const setHudState = useStore(state => state.setHudState);

  if (!hudState || !hudState.type) return null;

  const { type, data } = hudState;

  const containerStyle = {
    position: 'absolute',
    top: 48,
    left: 380, // Approximate position under transform buttons
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
              <span style={labelStyle}>X</span>
              <NumberInput
                value={data.rx}
                suffix="°"
                onCommit={(val) => updateSingleAxis('rot', 0, THREE.MathUtils.degToRad(val))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput
                value={data.ry}
                suffix="°"
                onCommit={(val) => updateSingleAxis('rot', 1, THREE.MathUtils.degToRad(val))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
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
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={labelStyle}>Distance</span>
            <span style={{ color: '#3b82f6', fontWeight: 600, fontFamily: 'monospace', fontSize: 14 }}>
              {data.distance?.toFixed(2) ?? '0.00'} mm
            </span>
          </div>
        );

      case 'drill':
        return (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Hole</span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>M3</span>
            </div>
            <div style={{ borderLeft: '1px solid #334155', paddingLeft: 12, color: '#94a3b8', fontSize: 11 }}>
              Click face to drill
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
