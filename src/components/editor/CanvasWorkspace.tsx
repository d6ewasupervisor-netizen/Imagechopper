import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const zones = useEditorStore(selectZones);
  const drawing = useEditorStore(selectDrawing);
  const tool = useEditorStore(selectTool);
  const selectedZoneIds = useEditorStore((state) => state.selectedZoneIds);
  const imageInfo = useEditorStore(selectImageInfo);
  const metrics = useEditorStore(selectCanvasMetrics);
  const adjustments = useEditorStore(selectAdjustments);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);

  const setCanvasMetrics = useEditorStore((state) => state.setCanvasMetrics);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const updateZone = useEditorStore((state) => state.updateZone);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const setPan = useEditorStore((state) => state.setPan);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
    if (spacePressed) return;
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

  const selectedZone = useMemo(() => {
    if (selectedZoneIds.length !== 1) return null;
    return zones.find((zone) => zone.id === selectedZoneIds[0]) ?? null;
  }, [selectedZoneIds, zones]);

  const handlePanStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    const isMiddleClick = event.button === 1;
    if (!spacePressed && !isMiddleClick) return;
    event.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePanMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = event.clientX - panStartRef.current.x;
    const dy = event.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    panStartRef.current = null;
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
          <span className="hint">{tool.toUpperCase()} tool</span>
        </div>
      </div>
      <div
        className="canvas-wrap"
        ref={wrapRef}
        data-pan-active={spacePressed ? "true" : "false"}
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
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {!imageInfo && (
          <div className="drop-overlay">
            <div className="drop-overlay-content">
              <div>Drag & drop an image here</div>
              <div className="hint">Supported: PNG, JPG, WebP</div>
              <div className="hint">or</div>
              <button className="btn primary" onClick={onOpenImage}>
                Open Image
              </button>
            </div>
          </div>
        )}
        <div
          className={`canvas-viewport ${isPanning ? "panning" : ""} ${
            spacePressed ? "pan-ready" : ""
          }`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
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
                          fill={
                            isSelected ? "rgba(96, 165, 250, 0.2)" : "rgba(148, 163, 184, 0.12)"
                          }
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
                        fill={
                          isSelected ? "rgba(52, 211, 153, 0.2)" : "rgba(148, 163, 184, 0.12)"
                        }
                        draggable={tool === "select"}
                        onDragEnd={(event) => handleDragEnd(zone, event)}
                        onClick={() => setSelectedZoneIds([zone.id])}
                      />
                    );
                  })}

                  {selectedZone && metrics && (
                    <>
                      <Rect
                        x={selectedZone.x * metrics.scale}
                        y={selectedZone.y * metrics.scale}
                        width={selectedZone.width * metrics.scale}
                        height={selectedZone.height * metrics.scale}
                        stroke="rgba(96, 165, 250, 0.7)"
                        strokeWidth={1}
                        dash={[4, 4]}
                      />
                      {[0, 1, 2, 3].map((idx) => {
                        const size = 8;
                        const x =
                          selectedZone.x +
                          (idx === 1 || idx === 2 ? selectedZone.width : 0);
                        const y =
                          selectedZone.y +
                          (idx === 2 || idx === 3 ? selectedZone.height : 0);
                        return (
                          <Rect
                            key={`handle-${idx}`}
                            x={x * metrics.scale - size / 2}
                            y={y * metrics.scale - size / 2}
                            width={size}
                            height={size}
                            fill="#e2e8f0"
                            stroke="#60a5fa"
                            strokeWidth={1}
                            cornerRadius={2}
                          />
                        );
                      })}
                    </>
                  )}

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
      </div>
      <div className="statusbar">
        <span>
          {imageInfo ? "Canvas ready" : "Waiting for image"} · Zoom {Math.round(zoom * 100)}%
        </span>
        <span>
          Zones {zones.length} · Selected {selectedZoneIds.length}
        </span>
      </div>
    </>
  );
};

export default CanvasWorkspace;
