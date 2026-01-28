import React, { createContext, useContext, useMemo, useRef } from "react";
import { CanvasManager } from "../canvas/core/CanvasManager";
import { PolygonTool } from "../canvas/tools/PolygonTool";
import { RectTool } from "../canvas/tools/RectTool";
import { ZoneToolContext } from "../canvas/tools/ZoneTool";
import { useEditorStore } from "../store/useEditorStore";
import { Point, Zone } from "../types/editor";

interface EditorActions {
  loadImageFromFile: (file: File) => Promise<void>;
  handlePointerDown: (point: Point) => void;
  handlePointerMove: (point: Point) => void;
  handlePointerUp: (point: Point) => void;
  handleDoubleClick: (point: Point) => void;
  exportZones: () => void;
  applyTemplate: (templateId: string) => void;
  applyRatio: (ratioId: string) => void;
}

interface EditorContextValue {
  canvasManager: React.MutableRefObject<CanvasManager>;
  actions: EditorActions;
}

const EditorContext = createContext<EditorContextValue | null>(null);

const buildToolContext = (): ZoneToolContext => ({
  getZones: () => useEditorStore.getState().zones,
  setZones: (zones: Zone[]) => useEditorStore.getState().setZones(zones),
  addZone: (zone: Zone) => useEditorStore.getState().addZone(zone),
  setSelectedZoneIds: (ids: string[]) => useEditorStore.getState().setSelectedZoneIds(ids),
  getDrawing: () => useEditorStore.getState().drawing,
  setDrawing: (drawing) => useEditorStore.getState().setDrawing(drawing),
  getImageSize: () => useEditorStore.getState().imageInfo,
  pushHistory: (label: string) => useEditorStore.getState().pushHistory(label),
});

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const canvasManagerRef = useRef(new CanvasManager());
  const toolsRef = useRef({
    rect: new RectTool(),
    polygon: new PolygonTool(),
  });

  const actions = useMemo<EditorActions>(() => {
    const getTool = () => useEditorStore.getState().tool;
    const toolContext = buildToolContext();

    const runTool = (fn: (point: Point) => void) => (point: Point) => {
      const tool = getTool();
      if (tool === "rect") fn(point);
      if (tool === "polygon") fn(point);
    };

    return {
      loadImageFromFile: async (file) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = url;
        });
        URL.revokeObjectURL(url);
        canvasManagerRef.current.setImage(img);
        useEditorStore.getState().setImageInfo({ width: img.width, height: img.height });
        useEditorStore.getState().clearZones();
        useEditorStore.getState().resetAdjustments();
        useEditorStore.getState().resetHistory();
        useEditorStore.getState().pushHistory("Load image");
      },
      handlePointerDown: (point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerDown(point, toolContext);
        if (tool === "polygon") toolsRef.current.polygon.onPointerDown(point, toolContext);
      },
      handlePointerMove: runTool((point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerMove(point, toolContext);
        if (tool === "polygon") toolsRef.current.polygon.onPointerMove(point, toolContext);
      }),
      handlePointerUp: runTool((point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerUp(point, toolContext);
        if (tool === "polygon") toolsRef.current.polygon.onPointerUp(point, toolContext);
      }),
      handleDoubleClick: (point) => {
        const tool = getTool();
        if (tool === "polygon" && toolsRef.current.polygon.onDoubleClick) {
          toolsRef.current.polygon.onDoubleClick(point, toolContext);
        }
      },
      exportZones: () => {
        const zones = useEditorStore.getState().zones;
        const exports = canvasManagerRef.current.exportZones(zones);
        exports.forEach((item) => {
          const link = document.createElement("a");
          link.download = item.name;
          link.href = item.dataUrl;
          link.click();
        });
      },
      applyTemplate: (templateId) => {
        const imageInfo = useEditorStore.getState().imageInfo;
        if (!imageInfo) return;
        const { width, height } = imageInfo;
        const zones: Zone[] = [];
        if (templateId === "rule-thirds") {
          const thirdW = width / 3;
          const thirdH = height / 3;
          for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 3; col += 1) {
              zones.push({
                id: crypto.randomUUID(),
                type: "rect",
                x: col * thirdW,
                y: row * thirdH,
                width: thirdW,
                height: thirdH,
              });
            }
          }
        }
        if (templateId === "golden-ratio") {
          const phi = 1.618;
          const shortW = width / phi;
          const shortH = height / phi;
          zones.push({
            id: crypto.randomUUID(),
            type: "rect",
            x: 0,
            y: 0,
            width: shortW,
            height: shortH,
          });
          zones.push({
            id: crypto.randomUUID(),
            type: "rect",
            x: shortW,
            y: 0,
            width: width - shortW,
            height: height,
          });
          zones.push({
            id: crypto.randomUUID(),
            type: "rect",
            x: 0,
            y: shortH,
            width: shortW,
            height: height - shortH,
          });
        }
        if (templateId === "product-tiles") {
          const cols = 2;
          const rows = 3;
          const tileW = width / cols;
          const tileH = height / rows;
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              zones.push({
                id: crypto.randomUUID(),
                type: "rect",
                x: col * tileW,
                y: row * tileH,
                width: tileW,
                height: tileH,
              });
            }
          }
        }
        if (zones.length === 0) return;
        useEditorStore.getState().setZones(zones);
        useEditorStore.getState().setSelectedZoneIds([]);
        useEditorStore.getState().setTool("select");
        useEditorStore.getState().pushHistory("Apply template");
      },
      applyRatio: (ratioId) => {
        const imageInfo = useEditorStore.getState().imageInfo;
        if (!imageInfo) return;
        const ratios: Record<string, number> = {
          "1:1": 1,
          "4:3": 4 / 3,
          "3:2": 3 / 2,
          "16:9": 16 / 9,
          "9:16": 9 / 16,
        };
        const ratio = ratios[ratioId];
        if (!ratio) return;
        let width = imageInfo.width;
        let height = width / ratio;
        if (height > imageInfo.height) {
          height = imageInfo.height;
          width = height * ratio;
        }
        const x = (imageInfo.width - width) / 2;
        const y = (imageInfo.height - height) / 2;
        const zone: Zone = {
          id: crypto.randomUUID(),
          type: "rect",
          x,
          y,
          width,
          height,
        };
        useEditorStore.getState().setZones([zone]);
        useEditorStore.getState().setSelectedZoneIds([zone.id]);
        useEditorStore.getState().setTool("select");
        useEditorStore.getState().pushHistory("Apply ratio");
      },
    };
  }, []);

  return (
    <EditorContext.Provider value={{ canvasManager: canvasManagerRef, actions }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return ctx;
};
