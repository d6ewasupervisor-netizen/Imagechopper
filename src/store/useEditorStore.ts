import { create } from "zustand";
import {
  AdjustmentSettings,
  CanvasMetrics,
  DrawingState,
  ImageInfo,
  ToolType,
  Zone,
} from "../types/editor";

interface EditorState {
  tool: ToolType;
  zones: Zone[];
  selectedZoneIds: string[];
  drawing: DrawingState;
  imageInfo: ImageInfo | null;
  canvasMetrics: CanvasMetrics | null;
  adjustments: AdjustmentSettings;
  setTool: (tool: ToolType) => void;
  addZone: (zone: Zone) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  setZones: (zones: Zone[]) => void;
  setSelectedZoneIds: (ids: string[]) => void;
  setDrawing: (drawing: DrawingState) => void;
  setImageInfo: (info: ImageInfo | null) => void;
  setCanvasMetrics: (metrics: CanvasMetrics | null) => void;
  setAdjustment: (key: keyof AdjustmentSettings, value: number) => void;
  resetAdjustments: () => void;
  clearZones: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  zones: [],
  selectedZoneIds: [],
  drawing: null,
  imageInfo: null,
  canvasMetrics: null,
  adjustments: { brightness: 0, contrast: 0, saturation: 0, blur: 0 },
  setTool: (tool) => set({ tool, drawing: null }),
  addZone: (zone) =>
    set((state) => ({
      zones: [...state.zones, zone],
      selectedZoneIds: [zone.id],
      drawing: null,
    })),
  updateZone: (id, updates) =>
    set((state) => ({
      zones: state.zones.map((zone) => (zone.id === id ? { ...zone, ...updates } : zone)),
    })),
  setZones: (zones) => set({ zones }),
  setSelectedZoneIds: (ids) => set({ selectedZoneIds: ids }),
  setDrawing: (drawing) => set({ drawing }),
  setImageInfo: (info) => set({ imageInfo: info }),
  setCanvasMetrics: (metrics) => set({ canvasMetrics: metrics }),
  setAdjustment: (key, value) =>
    set((state) => ({ adjustments: { ...state.adjustments, [key]: value } })),
  resetAdjustments: () =>
    set({ adjustments: { brightness: 0, contrast: 0, saturation: 0, blur: 0 } }),
  clearZones: () => set({ zones: [], selectedZoneIds: [], drawing: null }),
}));

export const selectZones = (state: EditorState) => state.zones;
export const selectTool = (state: EditorState) => state.tool;
export const selectDrawing = (state: EditorState) => state.drawing;
export const selectImageInfo = (state: EditorState) => state.imageInfo;
export const selectCanvasMetrics = (state: EditorState) => state.canvasMetrics;
export const selectAdjustments = (state: EditorState) => state.adjustments;
