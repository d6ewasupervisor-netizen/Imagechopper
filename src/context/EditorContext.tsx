import React, { createContext, useContext, useMemo, useRef } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { CanvasManager } from "../canvas/core/CanvasManager";
import { PolygonTool } from "../canvas/tools/PolygonTool";
import { RectTool } from "../canvas/tools/RectTool";
import { ZoneToolContext } from "../canvas/tools/ZoneTool";
import { useEditorStore } from "../store/useEditorStore";
import { Point, Zone } from "../types/editor";

interface EditorActions {
  loadImageFromFile: (file: File) => Promise<void>;
  saveProject: () => void;
  loadProjectFromFile: (file: File) => Promise<void>;
  handlePointerDown: (point: Point) => void;
  handlePointerMove: (point: Point) => void;
  handlePointerUp: (point: Point) => void;
  handleDoubleClick: (point: Point) => void;
  exportZones: () => Promise<void>;
  applyTemplate: (templateId: string) => void;
  applyRatio: (ratioId: string) => void;
}

interface EditorContextValue {
  canvasManager: React.MutableRefObject<CanvasManager>;
  actions: EditorActions;
}

const EditorContext = createContext<EditorContextValue | null>(null);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });

const buildToolContext = (): ZoneToolContext => ({
  getZones: () => useEditorStore.getState().zones,
  setZones: (zones: Zone[]) => useEditorStore.getState().setZones(zones),
  addZone: (zone: Zone) => {
    const { zones, isPro, maxFreeZones } = useEditorStore.getState();
    if (!isPro && zones.length >= maxFreeZones) {
      toast.message(`Free plan allows up to ${maxFreeZones} zones.`);
      return;
    }
    useEditorStore.getState().addZone(zone);
  },
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

    const loadImageFromDataUrl = async (dataUrl: string) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = dataUrl;
      });
      canvasManagerRef.current.setImage(img);
      return img;
    };

    return {
      loadImageFromFile: async (file) => {
        if (!file.type.startsWith("image/")) {
          toast.error("Unsupported file type. Please select an image.");
          return;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const img = await loadImageFromDataUrl(dataUrl);
          useEditorStore.getState().setImageInfo({ width: img.width, height: img.height });
          useEditorStore.getState().setImageDataUrl(dataUrl);
          useEditorStore.getState().clearZones();
          useEditorStore.getState().resetAdjustments();
          useEditorStore.getState().resetHistory();
          useEditorStore.getState().pushHistory("Load image");
          toast.success("Image loaded.");
        } catch (error) {
          toast.error("Could not load that image.");
          throw error;
        }
      },
      saveProject: () => {
        const { isPro, imageDataUrl, zones, adjustments, exportBaseName, exportFormat, exportQuality } =
          useEditorStore.getState();
        if (!isPro) {
          toast.message("Project files are available on Pro.");
          return;
        }
        if (!imageDataUrl) {
          toast.error("Load an image before saving a project.");
          return;
        }
        const payload = {
          version: 1,
          imageDataUrl,
          zones,
          adjustments,
          exportBaseName,
          exportFormat,
          exportQuality,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        downloadBlob(blob, "imagechopper-project.json");
        toast.success("Project saved.");
      },
      loadProjectFromFile: async (file) => {
        const { isPro } = useEditorStore.getState();
        if (!isPro) {
          toast.message("Project files are available on Pro.");
          return;
        }
        try {
          const text = await readFileAsText(file);
          const data = JSON.parse(text) as {
            version?: number;
            imageDataUrl?: string;
            zones?: Zone[];
            adjustments?: Record<string, number>;
            exportBaseName?: string;
            exportFormat?: "image/png" | "image/jpeg" | "image/webp";
            exportQuality?: number;
          };
          if (!data?.imageDataUrl || !Array.isArray(data.zones)) {
            toast.error("Invalid project file.");
            return;
          }
          const img = await loadImageFromDataUrl(data.imageDataUrl);
          useEditorStore.getState().setImageInfo({ width: img.width, height: img.height });
          useEditorStore.getState().setImageDataUrl(data.imageDataUrl);
          useEditorStore.getState().setZones(data.zones);
          if (data.adjustments) {
            useEditorStore.getState().resetAdjustments();
            useEditorStore.getState().setAdjustment("brightness", data.adjustments.brightness ?? 0);
            useEditorStore.getState().setAdjustment("contrast", data.adjustments.contrast ?? 0);
            useEditorStore.getState().setAdjustment("saturation", data.adjustments.saturation ?? 0);
            useEditorStore.getState().setAdjustment("blur", data.adjustments.blur ?? 0);
          }
          if (typeof data.exportBaseName === "string") {
            useEditorStore.getState().setExportBaseName(data.exportBaseName);
          }
          if (data.exportFormat) {
            useEditorStore.getState().setExportFormat(data.exportFormat);
          }
          if (typeof data.exportQuality === "number") {
            useEditorStore.getState().setExportQuality(data.exportQuality);
          }
          useEditorStore.getState().setSelectedZoneIds([]);
          useEditorStore.getState().resetHistory();
          useEditorStore.getState().pushHistory("Load project");
          toast.success("Project loaded.");
        } catch (error) {
          toast.error("Failed to load project.");
          throw error;
        }
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
      exportZones: async () => {
        const zones = useEditorStore.getState().zones;
        if (zones.length === 0) {
          toast.error("No zones to export yet.");
          return;
        }
        const baseName = useEditorStore.getState().exportBaseName.trim() || "custom";
        const { exportAsZip, isPro, exportFormat, exportQuality } = useEditorStore.getState();
        if (exportAsZip && !isPro) {
          toast.message("ZIP export is available on Pro.");
          return;
        }
        if (!isPro && exportFormat !== "image/png") {
          toast.message("JPEG/WebP exports are available on Pro.");
          return;
        }
        useEditorStore.getState().setExportAbort(false);
        useEditorStore
          .getState()
          .setExportStatus({ isExporting: true, exportProgress: 0, exportStatus: "Preparing" });
        try {
          const exports = await canvasManagerRef.current.exportZones(zones, baseName, {
            format: exportFormat,
            quality: exportFormat === "image/png" ? undefined : exportQuality,
            onProgress: (completed, total) => {
              useEditorStore.getState().setExportStatus({
                isExporting: true,
                exportProgress: total > 0 ? completed / total : 0,
                exportStatus: `Exporting ${completed}/${total}`,
              });
            },
            shouldCancel: () => useEditorStore.getState().exportAbort,
          });
          if (exportAsZip) {
            const zip = new JSZip();
            exports.forEach((item) => zip.file(item.name, item.blob));
            const blob = await zip.generateAsync({ type: "blob" });
            downloadBlob(blob, `${baseName}_zones.zip`);
          } else {
            exports.forEach((item) => downloadBlob(item.blob, item.name));
          }
          toast.success("Export complete.");
        } catch (error) {
          if (error instanceof Error && error.message === "Export canceled") {
            toast.message("Export canceled.");
          } else {
            toast.error("Export failed. Please try again.");
          }
        } finally {
          useEditorStore.getState().setExportStatus({
            isExporting: false,
            exportProgress: 0,
            exportStatus: "",
          });
          useEditorStore.getState().setExportAbort(false);
        }
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
        const gridMatch = templateId.match(/^grid-(\d+)x(\d+)$/);
        if (gridMatch) {
          const cols = Number(gridMatch[1]);
          const rows = Number(gridMatch[2]);
          if (cols > 0 && rows > 0) {
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
        }
        if (zones.length === 0) return;
        const { isPro, maxFreeZones } = useEditorStore.getState();
        if (!isPro && zones.length > maxFreeZones) {
          toast.message(`Free plan allows up to ${maxFreeZones} zones.`);
          return;
        }
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
