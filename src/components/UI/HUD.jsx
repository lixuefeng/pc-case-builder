import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import * as THREE from 'three';

const HUD = () => {
  const hudState = useStore(state => state.hudState);
  const setObjects = useStore(state => state.setObjects);
  const selectedIds = useStore(state => state.selectedIds);
  const objects = useStore(state => state.objects);

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
    
    useEffect(() => {
        // Only update from props if we are not focused? 
        // Actually, during drag we want to see updates.
        // But if user is typing, we don't want to overwrite.
        // Let's assume if user is typing, drag is not happening.
        // But if drag happens, user is not typing.
        // So we can safely update.
        // However, if we just setLocalValue here, it might override user typing if parent re-renders for other reasons.
        // But in this app, parent re-renders mostly due to drag or selection change.
        if (document.activeElement !== inputRef.current) {
             setLocalValue(value?.toFixed(2) ?? '0.00');
        }
    }, [value]);

    const inputRef = React.useRef(null);

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
            {suffix && <span style={{...labelStyle, marginLeft: 2}}>{suffix}</span>}
        </div>
    );
  };

  const updateObject = (key, value) => {
    if (selectedIds.length === 0) return;
    const id = selectedIds[0];
    setObjects(prev => prev.map(o => {
        if (o.id !== id) return o;
        
        if (key === 'pos') {
            // value is array [x, y, z]
            return { ...o, pos: value };
        }
        if (key === 'rot') {
             // value is array [x, y, z] in radians
            return { ...o, rot: value };
        }
        if (key === 'scale') {
             // value is array [x, y, z]
            return { ...o, scale: value };
        }
        return o;
    }));
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
                onCommit={(val) => updateObject('pos', [val, data.y, data.z])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput 
                value={data.y} 
                onCommit={(val) => updateObject('pos', [data.x, val, data.z])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
              <NumberInput 
                value={data.z} 
                onCommit={(val) => updateObject('pos', [data.x, data.y, val])} 
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
                onCommit={(val) => updateObject('rot', [THREE.MathUtils.degToRad(val), THREE.MathUtils.degToRad(data.ry), THREE.MathUtils.degToRad(data.rz)])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput 
                value={data.ry} 
                suffix="°"
                onCommit={(val) => updateObject('rot', [THREE.MathUtils.degToRad(data.rx), THREE.MathUtils.degToRad(val), THREE.MathUtils.degToRad(data.rz)])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
              <NumberInput 
                value={data.rz} 
                suffix="°"
                onCommit={(val) => updateObject('rot', [THREE.MathUtils.degToRad(data.rx), THREE.MathUtils.degToRad(data.ry), THREE.MathUtils.degToRad(val)])} 
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
                onCommit={(val) => updateObject('scale', [val, data.sy ?? data.factor ?? 1, data.sz ?? data.factor ?? 1])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Y</span>
              <NumberInput 
                value={data.sy ?? data.factor ?? 1} 
                suffix="x"
                onCommit={(val) => updateObject('scale', [data.sx ?? data.factor ?? 1, val, data.sz ?? data.factor ?? 1])} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>Z</span>
              <NumberInput 
                value={data.sz ?? data.factor ?? 1} 
                suffix="x"
                onCommit={(val) => updateObject('scale', [data.sx ?? data.factor ?? 1, data.sy ?? data.factor ?? 1, val])} 
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
