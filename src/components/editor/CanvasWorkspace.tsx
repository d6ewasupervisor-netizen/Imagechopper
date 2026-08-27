import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Ellipse, Layer, Line, Rect, Stage } from "react-konva";
import Konva from "konva";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";
import {
  clampZoneToImage,
  cloneZones,
  normalizeClientBox,
  rectsIntersect,
  selectionBounds,
  translateZone,
} from "../../lib/zoneOps";
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

const PALETTE = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#f87171"];

const hexToRgba = (color: string, alpha: number) => {
  if (!color.startsWith("#")) return color;
  const hex = color.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  if (normalized.length !== 6) return color;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const withDefaults = (zones: Zone[], existingCount = 0) =>
  zones.map((zone, index) => ({
    ...zone,
    label: zone.label ?? `Zone ${existingCount + index + 1}`,
    color: zone.color ?? PALETTE[(existingCount + index) % PALETTE.length],
  }));

type DragSession = {
  mode: "move" | "duplicate";
  primaryId: string;
  movingIds: string[];
  startById: Record<string, Zone>;
  nodeStart: { x: number; y: number };
};

type ContextMenuState = {
  clientX: number;
  clientY: number;
  imagePoint: Point | null;
};

type MarqueeSession = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  additive: boolean;
};

const CanvasWorkspace = ({ onOpenImage }: { onOpenImage: () => void }) => {
  const { canvasManager, actions } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const liveDeltaRef = useRef({ x: 0, y: 0 });
  const marqueeRef = useRef<MarqueeSession | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [liveDelta, setLiveDelta] = useState({ x: 0, y: 0 });
  const [marqueeBox, setMarqueeBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
  const isPro = useEditorStore((state) => state.isPro);
  const maxFreeZones = useEditorStore((state) => state.maxFreeZones);
  const clipboardZones = useEditorStore((state) => state.clipboardZones);

  const setCanvasMetrics = useEditorStore((state) => state.setCanvasMetrics);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const setZones = useEditorStore((state) => state.setZones);
  const setClipboardZones = useEditorStore((state) => state.setClipboardZones);
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
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        canvasManager.current.setCanvas(canvasRef.current);
      } catch {
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

  const getZoneOffset = (zoneId: string) => {
    const session = dragSessionRef.current;
    if (!session || !session.movingIds.includes(zoneId)) return { x: 0, y: 0 };
    return liveDelta;
  };

  const ensureCanAddZones = (count: number) => {
    if (isPro) return true;
    if (zones.length + count > maxFreeZones) {
      toast.message(`Free plan allows up to ${maxFreeZones} zones.`);
      return false;
    }
    return true;
  };

  const copySelectedZones = () => {
    const selected = zones.filter((zone) => selectedZoneIds.includes(zone.id));
    if (selected.length === 0) {
      toast.message("Select a zone to copy.");
      return;
    }
    setClipboardZones(cloneZones(selected));
    toast.success(
      selected.length === 1 ? "Zone copied." : `${selected.length} zones copied.`
    );
    setContextMenu(null);
  };

  const pasteClipboardZones = (atPoint?: Point | null) => {
    if (clipboardZones.length === 0) {
      toast.message("Clipboard is empty.");
      return;
    }
    if (!imageInfo) return;
    if (!ensureCanAddZones(clipboardZones.length)) return;

    const bounds = selectionBounds(clipboardZones);
    const pastePoint = atPoint ?? {
      x: (bounds?.x ?? 0) + 24,
      y: (bounds?.y ?? 0) + 24,
    };
    const offset = {
      x: pastePoint.x - (bounds?.x ?? 0),
      y: pastePoint.y - (bounds?.y ?? 0),
    };
    const pasted = withDefaults(
      cloneZones(clipboardZones, offset).map((zone) =>
        clampZoneToImage(zone, imageInfo.width, imageInfo.height)
      ),
      zones.length
    );
    setZones([...zones, ...pasted]);
    setSelectedZoneIds(pasted.map((zone) => zone.id));
    pushHistory(pasted.length === 1 ? "Paste zone" : "Paste zones");
    toast.success(pasted.length === 1 ? "Zone pasted." : `${pasted.length} zones pasted.`);
    setContextMenu(null);
  };

  const getZoneClientRect = (zone: Zone) => {
    const stage = stageRef.current;
    if (!stage || !metrics || metrics.displayWidth <= 0 || metrics.displayHeight <= 0) {
      return null;
    }
    const rect = stage.container().getBoundingClientRect();
    const scaleX = rect.width / metrics.displayWidth;
    const scaleY = rect.height / metrics.displayHeight;
    return {
      left: rect.left + zone.x * metrics.scale * scaleX,
      top: rect.top + zone.y * metrics.scale * scaleY,
      width: zone.width * metrics.scale * scaleX,
      height: zone.height * metrics.scale * scaleY,
    };
  };

  const updateMarqueeVisual = (session: MarqueeSession) => {
    setMarqueeBox(
      normalizeClientBox(
        session.startClientX,
        session.startClientY,
        session.currentClientX,
        session.currentClientY
      )
    );
  };

  const finishMarquee = () => {
    const session = marqueeRef.current;
    if (!session) return;
    const box = normalizeClientBox(
      session.startClientX,
      session.startClientY,
      session.currentClientX,
      session.currentClientY
    );
    marqueeRef.current = null;
    setMarqueeBox(null);

    if (box.width < 3 && box.height < 3) {
      if (!session.additive) {
        setSelectedZoneIds([]);
      }
      return;
    }

    const currentZones = useEditorStore.getState().zones;
    const currentSelected = useEditorStore.getState().selectedZoneIds;
    const hitIds = currentZones
      .filter((zone) => {
        const zoneRect = getZoneClientRect(zone);
        return zoneRect ? rectsIntersect(box, zoneRect) : false;
      })
      .map((zone) => zone.id);

    if (session.additive) {
      setSelectedZoneIds([...new Set([...currentSelected, ...hitIds])]);
    } else {
      setSelectedZoneIds(hitIds);
    }
  };

  const beginMarquee = (event: MouseEvent | ReactMouseEvent) => {
    if (tool !== "select" || spacePressed || event.button !== 0 || !imageInfo) return;
    event.preventDefault();
    setContextMenu(null);
    const session: MarqueeSession = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
      additive: event.shiftKey,
    };
    marqueeRef.current = session;
    updateMarqueeVisual(session);

    const handleMove = (moveEvent: MouseEvent) => {
      if (!marqueeRef.current) return;
      marqueeRef.current = {
        ...marqueeRef.current,
        currentClientX: moveEvent.clientX,
        currentClientY: moveEvent.clientY,
      };
      updateMarqueeVisual(marqueeRef.current);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      finishMarquee();
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleZoneClick = (zoneId: string, event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    if (tool !== "select") return;
    if (event.evt.shiftKey) {
      if (selectedZoneIds.includes(zoneId)) {
        setSelectedZoneIds(selectedZoneIds.filter((id) => id !== zoneId));
      } else {
        setSelectedZoneIds([...selectedZoneIds, zoneId]);
      }
      return;
    }
    if (selectedZoneIds.includes(zoneId) && selectedZoneIds.length > 1) {
      return;
    }
    setSelectedZoneIds([zoneId]);
  };

  const handleZoneContextMenu = (
    zoneId: string,
    event: Konva.KonvaEventObject<PointerEvent>
  ) => {
    event.evt.preventDefault();
    event.cancelBubble = true;
    if (tool !== "select") return;
    if (!selectedZoneIds.includes(zoneId)) {
      setSelectedZoneIds([zoneId]);
    }
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition() ?? null;
    setContextMenu({
      clientX: event.evt.clientX,
      clientY: event.evt.clientY,
      imagePoint: toImagePoint(pointer, metrics),
    });
  };

  const handleDragStart = (zone: Zone, event: Konva.KonvaEventObject<DragEvent>) => {
    if (tool !== "select" || !metrics) return;
    const ctrl = event.evt.ctrlKey || event.evt.metaKey;
    let targetIds = selectedZoneIds.includes(zone.id) ? [...selectedZoneIds] : [zone.id];
    if (!selectedZoneIds.includes(zone.id)) {
      setSelectedZoneIds([zone.id]);
      targetIds = [zone.id];
    }

    const nodeStart = { x: event.target.x(), y: event.target.y() };

    if (ctrl) {
      const sources = zones.filter((entry) => targetIds.includes(entry.id));
      if (!ensureCanAddZones(sources.length)) {
        event.target.stopDrag();
        return;
      }
      const clones = withDefaults(cloneZones(sources), zones.length);
      const nextZones = [...zones, ...clones];
      setZones(nextZones);
      const cloneIds = clones.map((entry) => entry.id);
      setSelectedZoneIds(cloneIds);
      dragSessionRef.current = {
        mode: "duplicate",
        primaryId: zone.id,
        movingIds: cloneIds,
        startById: Object.fromEntries(clones.map((entry) => [entry.id, entry])),
        nodeStart,
      };
      setLiveDelta({ x: 0, y: 0 });
      return;
    }

    const moving = zones.filter((entry) => targetIds.includes(entry.id));
    dragSessionRef.current = {
      mode: "move",
      primaryId: zone.id,
      movingIds: targetIds,
      startById: Object.fromEntries(moving.map((entry) => [entry.id, entry])),
      nodeStart,
    };
    setLiveDelta({ x: 0, y: 0 });
  };

  const handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
    const session = dragSessionRef.current;
    if (!session || !metrics) return;
    const dx = (event.target.x() - session.nodeStart.x) / metrics.scale;
    const dy = (event.target.y() - session.nodeStart.y) / metrics.scale;
    event.target.position(session.nodeStart);
    liveDeltaRef.current = { x: dx, y: dy };
    setLiveDelta({ x: dx, y: dy });
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const session = dragSessionRef.current;
    if (!session || !metrics || !imageInfo) {
      return;
    }
    const dx = liveDeltaRef.current.x;
    const dy = liveDeltaRef.current.y;
    event.target.position(session.nodeStart);

    const currentZones = useEditorStore.getState().zones;
    const nextZones = currentZones.map((zone) => {
      if (!session.movingIds.includes(zone.id)) return zone;
      const start = session.startById[zone.id] ?? zone;
      return clampZoneToImage(translateZone(start, dx, dy), imageInfo.width, imageInfo.height);
    });

    setZones(nextZones);
    liveDeltaRef.current = { x: 0, y: 0 };
    setLiveDelta({ x: 0, y: 0 });
    dragSessionRef.current = null;
    pushHistory(session.mode === "duplicate" ? "Duplicate zones" : "Move zones");
  };

  const selectedZones = useMemo(
    () => zones.filter((zone) => selectedZoneIds.includes(zone.id)),
    [zones, selectedZoneIds]
  );

  const multiBounds = useMemo(() => {
    if (selectedZones.length < 2) return null;
    const offsetZones = selectedZones.map((zone) => {
      const offset = getZoneOffset(zone.id);
      return translateZone(zone, offset.x, offset.y);
    });
    return selectionBounds(offsetZones);
  }, [selectedZones, liveDelta]);

  const handlePanStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    const isMiddleClick = event.button === 1;
    if (!spacePressed && !isMiddleClick) {
      if (
        tool === "select" &&
        event.button === 0 &&
        imageInfo &&
        !(event.target as HTMLElement).closest(".zone-context-menu")
      ) {
        const target = event.target as HTMLElement;
        const onKonvaSurface = Boolean(target.closest(".konva-overlay"));
        // Empty padding around the image — start marquee here.
        // Clicks on the Konva stage are handled by Stage onMouseDown.
        if (!onKonvaSurface) {
          beginMarquee(event);
        }
      }
      return;
    }
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

  const renderZoneShape = (zone: Zone) => {
    if (!metrics) return null;
    const isSelected = selectedZoneIds.includes(zone.id);
    const strokeColor = zone.color ?? "#94a3b8";
    const fillColor = hexToRgba(strokeColor, isSelected ? 0.22 : 0.16);
    const offset = getZoneOffset(zone.id);
    const common = {
      stroke: strokeColor,
      strokeWidth: isSelected ? 3 : 2,
      fill: fillColor,
      draggable: tool === "select",
      onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => handleDragStart(zone, event),
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => handleZoneClick(zone.id, event),
      onTap: (event: Konva.KonvaEventObject<Event>) =>
        handleZoneClick(zone.id, event as Konva.KonvaEventObject<MouseEvent>),
      onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) =>
        handleZoneContextMenu(zone.id, event),
    };

    if (zone.type === "rect") {
      return (
        <Rect
          key={zone.id}
          x={(zone.x + offset.x) * metrics.scale}
          y={(zone.y + offset.y) * metrics.scale}
          width={zone.width * metrics.scale}
          height={zone.height * metrics.scale}
          {...common}
        />
      );
    }
    if (zone.type === "ellipse") {
      return (
        <Ellipse
          key={zone.id}
          x={(zone.x + zone.width / 2 + offset.x) * metrics.scale}
          y={(zone.y + zone.height / 2 + offset.y) * metrics.scale}
          radiusX={(zone.width * metrics.scale) / 2}
          radiusY={(zone.height * metrics.scale) / 2}
          {...common}
        />
      );
    }
    return (
      <Line
        key={zone.id}
        points={zone.points.flatMap((point) => [
          (point.x + offset.x) * metrics.scale,
          (point.y + offset.y) * metrics.scale,
        ])}
        closed
        {...common}
      />
    );
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
        onContextMenu={(event) => {
          if (tool !== "select" || !imageInfo) return;
          // empty-canvas paste menu
          if ((event.target as HTMLElement).closest(".konva-overlay")) return;
        }}
      >
        {!imageInfo && (
          <div className="drop-overlay">
            <div className="drop-overlay-content">
              <div>Drag & drop an image here</div>
              <div className="hint">Supported: PNG, JPG, WebP</div>
              <div className="hint">or</div>
              <button
                type="button"
                className="btn primary"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenImage();
                }}
              >
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
                ref={(node) => {
                  stageRef.current = node;
                }}
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={(event) => {
                  if (
                    tool === "select" &&
                    !spacePressed &&
                    event.target === event.target.getStage()
                  ) {
                    beginMarquee(event.evt);
                    return;
                  }
                  handlePointer(event, actions.handlePointerDown);
                }}
                onMouseMove={(event) => handlePointer(event, actions.handlePointerMove)}
                onMouseUp={(event) => handlePointer(event, actions.handlePointerUp)}
                onDblClick={(event) => handlePointer(event, actions.handleDoubleClick)}
                onTouchStart={(event) => handlePointer(event, actions.handlePointerDown)}
                onTouchMove={(event) => handlePointer(event, actions.handlePointerMove)}
                onTouchEnd={(event) => handlePointer(event, actions.handlePointerUp)}
                onContextMenu={(event) => {
                  if (tool !== "select") return;
                  if (event.target !== event.target.getStage()) return;
                  event.evt.preventDefault();
                  const pointer = event.target.getStage()?.getPointerPosition() ?? null;
                  setContextMenu({
                    clientX: event.evt.clientX,
                    clientY: event.evt.clientY,
                    imagePoint: toImagePoint(pointer, metrics),
                  });
                }}
              >
                <Layer>
                  {zones.map((zone) => renderZoneShape(zone))}

                  {multiBounds && metrics && (
                    <Rect
                      x={multiBounds.x * metrics.scale}
                      y={multiBounds.y * metrics.scale}
                      width={multiBounds.width * metrics.scale}
                      height={multiBounds.height * metrics.scale}
                      stroke="rgba(96, 165, 250, 0.85)"
                      strokeWidth={1}
                      dash={[5, 4]}
                      listening={false}
                    />
                  )}

                  {selectedZones.length === 1 && metrics && (() => {
                    const selectedZone = selectedZones[0];
                    const offset = getZoneOffset(selectedZone.id);
                    return (
                      <>
                        <Rect
                          x={(selectedZone.x + offset.x) * metrics.scale}
                          y={(selectedZone.y + offset.y) * metrics.scale}
                          width={selectedZone.width * metrics.scale}
                          height={selectedZone.height * metrics.scale}
                          stroke={hexToRgba(selectedZone.color ?? "#60a5fa", 0.7)}
                          strokeWidth={1}
                          dash={[4, 4]}
                          listening={false}
                        />
                        {[0, 1, 2, 3].map((idx) => {
                          const size = 8;
                          const x =
                            selectedZone.x +
                            offset.x +
                            (idx === 1 || idx === 2 ? selectedZone.width : 0);
                          const y =
                            selectedZone.y +
                            offset.y +
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
                              listening={false}
                            />
                          );
                        })}
                      </>
                    );
                  })()}

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
                  {drawing?.type === "ellipse" && (
                    <Ellipse
                      x={((drawing.start.x + drawing.current.x) / 2) * metrics.scale}
                      y={((drawing.start.y + drawing.current.y) / 2) * metrics.scale}
                      radiusX={(Math.abs(drawing.start.x - drawing.current.x) / 2) * metrics.scale}
                      radiusY={(Math.abs(drawing.start.y - drawing.current.y) / 2) * metrics.scale}
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

        {marqueeBox && (
          <div
            className="marquee-guide"
            style={{
              left: marqueeBox.left,
              top: marqueeBox.top,
              width: marqueeBox.width,
              height: marqueeBox.height,
            }}
          />
        )}

        {contextMenu && (
          <div
            className="zone-context-menu"
            style={{ left: contextMenu.clientX, top: contextMenu.clientY }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="context-menu-item"
              disabled={selectedZoneIds.length === 0}
              onClick={copySelectedZones}
            >
              Copy{selectedZoneIds.length > 1 ? ` (${selectedZoneIds.length})` : ""}
            </button>
            <button
              type="button"
              className="context-menu-item"
              disabled={clipboardZones.length === 0}
              onClick={() => pasteClipboardZones(contextMenu.imagePoint)}
            >
              Paste{clipboardZones.length > 1 ? ` (${clipboardZones.length})` : ""}
            </button>
          </div>
        )}
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
