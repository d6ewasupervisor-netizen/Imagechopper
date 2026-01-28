import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Line, Rect, Stage } from "react-konva";
import Konva from "konva";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";
import {
  selectCanvasMetrics,
  selectDrawing,
  selectAdjustments,
  selectImageInfo,
  selectTool,
  selectZones,
  useEditorStore,
} from "../../store/useEditorStore";
import { CanvasMetrics, Point, Zone } from "../../types/editor";

const computeBounds = (points: Point[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const CanvasWorkspace = ({ onOpenImage }: { onOpenImage: () => void }) => {
  const { canvasManager, actions } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const zones = useEditorStore(selectZones);
  const drawing = useEditorStore(selectDrawing);
  const tool = useEditorStore(selectTool);
  const selectedZoneIds = useEditorStore((state) => state.selectedZoneIds);
  const imageInfo = useEditorStore(selectImageInfo);
  const metrics = useEditorStore(selectCanvasMetrics);
  const adjustments = useEditorStore(selectAdjustments);

  const setCanvasMetrics = useEditorStore((state) => state.setCanvasMetrics);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const updateZone = useEditorStore((state) => state.updateZone);
  const pushHistory = useEditorStore((state) => state.pushHistory);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        canvasManager.current.setCanvas(canvasRef.current);
      } catch (error) {
        toast.error("Canvas could not initialize in this browser.");
      }
    }
  }, [canvasManager]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setViewport({ width, height });
      }
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageInfo || !wrapRef.current) return;
    if (viewport.width > 0 && viewport.height > 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setViewport({ width: rect.width, height: rect.height });
    }
  }, [imageInfo, viewport]);

  useEffect(() => {
    if (!imageInfo) return;
    canvasManager.current.setAdjustments(adjustments);
    const nextMetrics = canvasManager.current.render(viewport.width, viewport.height);
    setCanvasMetrics(nextMetrics ?? null);
  }, [canvasManager, imageInfo, viewport, adjustments, setCanvasMetrics]);

  const stageSize = useMemo(() => {
    if (!metrics) return { width: 0, height: 0 };
    return { width: metrics.displayWidth, height: metrics.displayHeight };
  }, [metrics]);

  const toImagePoint = (pos: Konva.Vector2d | null, canvasMetrics: CanvasMetrics | null) => {
    if (!pos || !canvasMetrics) return null;
    return {
      x: pos.x / canvasMetrics.scale,
      y: pos.y / canvasMetrics.scale,
    };
  };

  const handlePointer = (
    event: Konva.KonvaEventObject<MouseEvent>,
    handler: (point: Point) => void
  ) => {
    const position = event.target.getStage()?.getPointerPosition() ?? null;
    const imagePoint = toImagePoint(position, metrics);
    if (imagePoint) {
      handler(imagePoint);
    }
  };

  const handleDragEnd = (zone: Zone, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!metrics) return;
    const node = event.target;
    if (zone.type === "rect") {
      updateZone(zone.id, {
        x: node.x() / metrics.scale,
        y: node.y() / metrics.scale,
      });
      pushHistory("Move zone");
      return;
    }
    const dx = node.x() / metrics.scale;
    const dy = node.y() / metrics.scale;
    const nextPoints = zone.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));
    const bounds = computeBounds(nextPoints);
    updateZone(zone.id, { points: nextPoints, ...bounds });
    node.position({ x: 0, y: 0 });
    pushHistory("Move zone");
  };

  return (
    <>
      <div className="canvas-toolbar">
        <div className="toolbar-left">
          <span className="hint">
            {imageInfo
              ? `Image loaded (${imageInfo.width} x ${imageInfo.height})`
              : "Ready"}
          </span>
        </div>
        <div className="toolbar-right">
          <span className="hint">{zones.length} zones</span>
        </div>
      </div>
      <div
        className="canvas-wrap"
        ref={wrapRef}
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) {
            try {
              await actions.loadImageFromFile(file);
            } catch {
              // handled via toast
            }
          }
        }}
      >
        {!imageInfo && (
          <div className="drop-overlay">
            <div className="drop-overlay-content">
              <div>Drag & drop an image here</div>
              <div className="hint">or</div>
              <button className="btn primary" onClick={onOpenImage}>
                Open Image
              </button>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="preview-canvas" />
        <div className={`konva-overlay ${imageInfo ? "active" : ""}`}>
          {metrics && (
            <Stage
              width={stageSize.width}
              height={stageSize.height}
              onMouseDown={(event) => handlePointer(event, actions.handlePointerDown)}
              onMouseMove={(event) => handlePointer(event, actions.handlePointerMove)}
              onMouseUp={(event) => handlePointer(event, actions.handlePointerUp)}
              onDblClick={(event) => handlePointer(event, actions.handleDoubleClick)}
              onTouchStart={(event) => handlePointer(event, actions.handlePointerDown)}
              onTouchMove={(event) => handlePointer(event, actions.handlePointerMove)}
              onTouchEnd={(event) => handlePointer(event, actions.handlePointerUp)}
              onClick={(event) => {
                if (tool === "select" && event.target === event.target.getStage()) {
                  setSelectedZoneIds([]);
                }
              }}
            >
              <Layer>
                {zones.map((zone) => {
                  const isSelected = selectedZoneIds.includes(zone.id);
                  if (zone.type === "rect") {
                    return (
                      <Rect
                        key={zone.id}
                        x={zone.x * metrics.scale}
                        y={zone.y * metrics.scale}
                        width={zone.width * metrics.scale}
                        height={zone.height * metrics.scale}
                        stroke={isSelected ? "#60a5fa" : "#94a3b8"}
                        strokeWidth={2}
                        fill={isSelected ? "rgba(96, 165, 250, 0.2)" : "rgba(148, 163, 184, 0.12)"}
                        draggable={tool === "select"}
                        onDragEnd={(event) => handleDragEnd(zone, event)}
                        onClick={() => setSelectedZoneIds([zone.id])}
                      />
                    );
                  }
                  return (
                    <Line
                      key={zone.id}
                      points={zone.points.flatMap((point) => [
                        point.x * metrics.scale,
                        point.y * metrics.scale,
                      ])}
                      closed
                      stroke={isSelected ? "#34d399" : "#94a3b8"}
                      strokeWidth={2}
                      fill={isSelected ? "rgba(52, 211, 153, 0.2)" : "rgba(148, 163, 184, 0.12)"}
                      draggable={tool === "select"}
                      onDragEnd={(event) => handleDragEnd(zone, event)}
                      onClick={() => setSelectedZoneIds([zone.id])}
                    />
                  );
                })}
                {drawing?.type === "rect" && (
                  <Rect
                    x={Math.min(drawing.start.x, drawing.current.x) * metrics.scale}
                    y={Math.min(drawing.start.y, drawing.current.y) * metrics.scale}
                    width={Math.abs(drawing.start.x - drawing.current.x) * metrics.scale}
                    height={Math.abs(drawing.start.y - drawing.current.y) * metrics.scale}
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                )}
                {drawing?.type === "polygon" && (
                  <Line
                    points={[
                      ...drawing.points.flatMap((point) => [
                        point.x * metrics.scale,
                        point.y * metrics.scale,
                      ]),
                      ...(drawing.current
                        ? [drawing.current.x * metrics.scale, drawing.current.y * metrics.scale]
                        : []),
                    ]}
                    stroke="#34d399"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                )}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
      <div className="statusbar">
        <span>{imageInfo ? "Canvas ready" : "Waiting for image"}</span>
        <span>{zones.length} zones</span>
      </div>
    </>
  );
};

export default CanvasWorkspace;
