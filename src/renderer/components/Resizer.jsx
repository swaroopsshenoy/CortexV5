import React, { useRef, useEffect } from "react";

export default function Resizer({ onDrag, direction = "horizontal" }) {
  const isResizing = useRef(false);
  const lastPos = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      
      if (direction === "horizontal") {
        const delta = e.clientX - lastPos.current;
        lastPos.current = e.clientX;
        onDrag(delta);
      } else {
        const delta = e.clientY - lastPos.current;
        lastPos.current = e.clientY;
        onDrag(delta);
      }
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "default";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onDrag, direction]);

  const handleMouseDown = (e) => {
    isResizing.current = true;
    lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    e.preventDefault();
  };

  return (
    <div
      className={`resize-handle resize-handle--${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
}
