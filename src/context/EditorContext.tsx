import React, { createContext, useContext, useMemo, useRef } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { CanvasManager } from "../canvas/core/CanvasManager";
import { EllipseTool } from "../canvas/tools/EllipseTool";
import { PolygonTool } from "../canvas/tools/PolygonTool";
import { RectTool } from "../canvas/tools/RectTool";
import { ZoneToolContext } from "../canvas/tools/ZoneTool";
import { requestAutoSelect } from "../lib/auth";
import { useEditorStore } from "../store/useEditorStore";
import { Point, Zone } from "../types/editor";

interface EditorActions {
  loadImageFromFile: (file: File) => Promise<void>;
  saveProject: () => void;
  loadProjectFromFile: (file: File) => Promise<void>;
  exportMetadata: () => void;
  handlePointerDown: (point: Point) => void;
  handlePointerMove: (point: Point) => void;
  handlePointerUp: (point: Point) => void;
  handleDoubleClick: (point: Point) => void;
  exportZones: () => Promise<void>;
  applyTemplate: (templateId: string) => void;
  applyRatio: (ratioId: string) => void;
  autoSelectZones: () => Promise<void>;
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

const PALETTE = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#f87171"];

const downscaleDataUrl = async (dataUrl: string, maxEdge = 1280) => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to prepare image."));
    image.src = dataUrl;
  });
  const longest = Math.max(img.width, img.height);
  if (longest <= maxEdge) return dataUrl;
  const scale = maxEdge / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
};

const applyZoneDefaults = (zones: Zone[], existingCount = 0) =>
  zones.map((zone, index) => ({
    ...zone,
    label: zone.label ?? `Zone ${existingCount + index + 1}`,
    color: zone.color ?? PALETTE[(existingCount + index) % PALETTE.length],
  }));

const buildToolContext = (): ZoneToolContext => ({
  getZones: () => useEditorStore.getState().zones,
  setZones: (zones: Zone[]) => useEditorStore.getState().setZones(zones),
  addZone: (zone: Zone) => {
    const { zones, isPro, maxFreeZones } = useEditorStore.getState();
    if (!isPro && zones.length >= maxFreeZones) {
      toast.message(`Free plan allows up to ${maxFreeZones} zones.`);
      return;
    }
    const [withDefaults] = applyZoneDefaults([zone], zones.length);
    useEditorStore.getState().addZone(withDefaults);
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
    ellipse: new EllipseTool(),
    polygon: new PolygonTool(),
  });

  const actions = useMemo<EditorActions>(() => {
    const getTool = () => useEditorStore.getState().tool;
    const toolContext = buildToolContext();

    const runTool = (fn: (point: Point) => void) => (point: Point) => {
      const tool = getTool();
      if (tool === "rect") fn(point);
      if (tool === "ellipse") fn(point);
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

    const formatName = (
      pattern: string,
      zone: Zone,
      index: number,
      extension: string,
      baseName: string
    ) => {
      const safeLabel = (zone.label ?? "zone").replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
      const idx = String(index + 1).padStart(2, "0");
      const replacements: Record<string, string> = {
        "{base}": baseName,
        "{index}": idx,
        "{label}": safeLabel,
        "{w}": String(Math.round(zone.width)),
        "{h}": String(Math.round(zone.height)),
      };
      const trimmed = pattern.trim();
      const basePattern = trimmed.length > 0 ? trimmed : "{base}_{index}";
      const name = Object.entries(replacements).reduce(
        (value, [token, rep]) => value.split(token).join(rep),
        basePattern
      );
      return `${name}.${extension}`;
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
        const {
          isPro,
          imageDataUrl,
          zones,
          adjustments,
          exportBaseName,
          exportFormat,
          exportQuality,
          exportNamePattern,
        } = useEditorStore.getState();
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
          exportNamePattern,
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
            exportNamePattern?: string;
          };
          if (!data?.imageDataUrl || !Array.isArray(data.zones)) {
            toast.error("Invalid project file.");
            return;
          }
          const img = await loadImageFromDataUrl(data.imageDataUrl);
          useEditorStore.getState().setImageInfo({ width: img.width, height: img.height });
          useEditorStore.getState().setImageDataUrl(data.imageDataUrl);
          useEditorStore.getState().setZones(applyZoneDefaults(data.zones));
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
          if (typeof data.exportNamePattern === "string") {
            useEditorStore.getState().setExportNamePattern(data.exportNamePattern);
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
      exportMetadata: () => {
        const { isPro, imageInfo, zones, exportBaseName } = useEditorStore.getState();
        if (!isPro) {
          toast.message("Metadata export is available on Pro.");
          return;
        }
        if (!imageInfo) {
          toast.error("Load an image before exporting metadata.");
          return;
        }
        const payload = {
          version: 1,
          image: imageInfo,
          zones: zones.map((zone) => ({
            id: zone.id,
            type: zone.type,
            label: zone.label ?? "",
            color: zone.color ?? "",
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            points: zone.type === "polygon" ? zone.points : undefined,
          })),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const name = `${exportBaseName.trim() || "custom"}_metadata.json`;
        downloadBlob(blob, name);
        toast.success("Metadata exported.");
      },
      handlePointerDown: (point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerDown(point, toolContext);
        if (tool === "ellipse") toolsRef.current.ellipse.onPointerDown(point, toolContext);
        if (tool === "polygon") toolsRef.current.polygon.onPointerDown(point, toolContext);
      },
      handlePointerMove: runTool((point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerMove(point, toolContext);
        if (tool === "ellipse") toolsRef.current.ellipse.onPointerMove(point, toolContext);
        if (tool === "polygon") toolsRef.current.polygon.onPointerMove(point, toolContext);
      }),
      handlePointerUp: runTool((point) => {
        const tool = getTool();
        if (tool === "rect") toolsRef.current.rect.onPointerUp(point, toolContext);
        if (tool === "ellipse") toolsRef.current.ellipse.onPointerUp(point, toolContext);
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
        const { exportAsZip, isPro, exportFormat, exportQuality, exportNamePattern } =
          useEditorStore.getState();
        // For free users, disable ZIP export and proceed with individual downloads
        const shouldExportAsZip = exportAsZip && isPro;
        if (exportAsZip && !isPro) {
          toast.message("ZIP export is available on Pro. Exporting as individual files.");
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
            nameForZone: (zone, index, extension, base) =>
              formatName(exportNamePattern, zone, index, extension, base),
            onProgress: (completed, total) => {
              useEditorStore.getState().setExportStatus({
                isExporting: true,
                exportProgress: total > 0 ? completed / total : 0,
                exportStatus: `Exporting ${completed}/${total}`,
              });
            },
            shouldCancel: () => useEditorStore.getState().exportAbort,
          });
          if (shouldExportAsZip) {
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
        const gridMatch = templateId.match(/^grid-(\d+)x(\d+)(?:-(gutter|contact))?$/);
        const contactMatch = templateId.match(/^contact-(\d+)x(\d+)$/);
        if (gridMatch || contactMatch) {
          const cols = Number((gridMatch || contactMatch)![1]);
          const rows = Number((gridMatch || contactMatch)![2]);
          const useGutter =
            Boolean(contactMatch) ||
            gridMatch?.[3] === "gutter" ||
            gridMatch?.[3] === "contact";
          if (cols > 0 && rows > 0) {
            const tileW = width / cols;
            const tileH = height / rows;
            const insetX = useGutter ? tileW * 0.045 : 0;
            const insetY = useGutter ? tileH * 0.05 : 0;
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                zones.push({
                  id: crypto.randomUUID(),
                  type: "rect",
                  x: col * tileW + insetX,
                  y: row * tileH + insetY,
                  width: Math.max(1, tileW - insetX * 2),
                  height: Math.max(1, tileH - insetY * 2),
                });
              }
            }
          }
        }
        if (zones.length === 0) return;
        const { isPro, maxFreeZones } = useEditorStore.getState();
        const gridSizeMatch = templateId.match(/(?:grid|contact)-(\d+)x(\d+)/);
        const templateZoneCount = gridSizeMatch
          ? Number(gridSizeMatch[1]) * Number(gridSizeMatch[2])
          : zones.length;
        if (!isPro && (zones.length > maxFreeZones || templateZoneCount > maxFreeZones)) {
          toast.message(
            `Pro required for ${Math.max(zones.length, templateZoneCount)}-zone templates (free limit ${maxFreeZones}).`
          );
          return;
        }
        const withDefaults = applyZoneDefaults(zones);
        useEditorStore.getState().setZones(withDefaults);
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
        const [withDefaults] = applyZoneDefaults([zone]);
        useEditorStore.getState().setZones([withDefaults]);
        useEditorStore.getState().setSelectedZoneIds([zone.id]);
        useEditorStore.getState().setTool("select");
        useEditorStore.getState().pushHistory("Apply ratio");
      },
      autoSelectZones: async () => {
        const { isPro, imageDataUrl, imageInfo } = useEditorStore.getState();
        if (!isPro) {
          toast.message("Auto Select is available on Pro.");
          return;
        }
        if (!imageDataUrl || !imageInfo) {
          toast.error("Load an image first.");
          return;
        }
        const toastId = toast.loading("Auto Select running...");
        try {
          const prepared = await downscaleDataUrl(imageDataUrl);
          const detected = await requestAutoSelect({
            imageDataUrl: prepared,
            imageWidth: imageInfo.width,
            imageHeight: imageInfo.height,
          });
          const zones: Zone[] = detected.map((zone) => ({
            id: crypto.randomUUID(),
            type: "rect",
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            label: zone.label,
          }));
          const withDefaults = applyZoneDefaults(zones);
          useEditorStore.getState().setZones(withDefaults);
          useEditorStore.getState().setSelectedZoneIds(withDefaults.map((zone) => zone.id));
          useEditorStore.getState().setTool("select");
          useEditorStore.getState().pushHistory("Auto Select");
          toast.success(`Auto Select found ${withDefaults.length} zones.`, { id: toastId });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Auto Select failed.", {
            id: toastId,
          });
        }
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
