import React, { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";

const CustomNode = ({ data, isConnectable }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const onBlur = () => {
    setIsEditing(false);
    if (data.onChange) {
      data.onChange(label);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      if (data.onChange) {
        data.onChange(label);
      }
    }
  };

  return (
    <div
      onDoubleClick={onDoubleClick}
      style={{
        background: "#fff",
        border: "1px solid #777",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "150px",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      {isEditing ? (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          autoFocus
          className="nodrag"
          style={{
            border: "none",
            background: "transparent",
            width: "100%",
            outline: "none",
          }}
        />
      ) : (
        <div>{label}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default memo(CustomNode);
