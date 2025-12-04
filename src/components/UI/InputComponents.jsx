import React from "react";

const inputStyle = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  marginBottom: 8,
  color: "#0f172a",
  background: "#fff",
};

const rowStyle = {
  display: "flex",
  gap: 8,
  marginBottom: 8,
};

const labelStyle = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 4,
  display: "block",
  fontWeight: 600,
};

export const NumberInput = ({ value, onChange, placeholder, style }) => (
  <input
    type="number"
    style={{ ...inputStyle, ...style }}
    value={value ?? 0}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

export const InputRow = ({ children }) => (
  <div style={rowStyle}>
    {children}
  </div>
);

export const Vector3Input = ({ 
  values, 
  onChange, 
  labels = ["X", "Y", "Z"], 
  keys = ["x", "y", "z"],
  placeholders 
}) => {
  return (
    <div style={rowStyle}>
      {keys.map((key, index) => (
        <NumberInput
          key={key}
          value={Array.isArray(values) ? values[index] : values?.[key]}
          onChange={(val) => onChange(key, val)}
          placeholder={placeholders ? placeholders[index] : labels[index]}
        />
      ))}
    </div>
  );
};

export const DimensionsInput = ({ values, onChange }) => (
  <Vector3Input
    values={values}
    onChange={onChange}
    labels={["W", "H", "D"]}
    keys={["w", "h", "d"]}
    placeholders={["W", "H", "D"]}
  />
);

export const SectionLabel = ({ children }) => (
  <label style={labelStyle}>{children}</label>
);
