import { create } from "zustand";
import {
  AdjustmentSettings,
  CanvasMetrics,
  DrawingState,
  ImageInfo,
  ToolType,
  Zone,
} from "../types/editor";

const cloneZones = (zones: Zone[]) => JSON.parse(JSON.stringify(zones)) as Zone[];
const cloneAdjustments = (adjustments: AdjustmentSettings) => ({ ...adjustments });

interface HistorySnapshot {
  label: string;
  zones: Zone[];
  adjustments: AdjustmentSettings;
  selectedZoneIds: string[];
}

interface EditorState {
  tool: ToolType;
  zones: Zone[];
  selectedZoneIds: string[];
  drawing: DrawingState;
  imageInfo: ImageInfo | null;
  canvasMetrics: CanvasMetrics | null;
  adjustments: AdjustmentSettings;
  exportBaseName: string;
  exportAsZip: boolean;
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  history: HistorySnapshot[];
  redo: HistorySnapshot[];
  historyLimit: number;
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
  setExportBaseName: (name: string) => void;
  setExportAsZip: (value: boolean) => void;
  setExportStatus: (status: {
    isExporting: boolean;
    exportProgress: number;
    exportStatus: string;
  }) => void;
  pushHistory: (label: string) => void;
  undo: () => void;
  redoAction: () => void;
  resetHistory: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  zones: [],
  selectedZoneIds: [],
  drawing: null,
  imageInfo: null,
  canvasMetrics: null,
  adjustments: { brightness: 0, contrast: 0, saturation: 0, blur: 0 },
  exportBaseName: "custom",
  exportAsZip: true,
  isExporting: false,
  exportProgress: 0,
  exportStatus: "",
  history: [],
  redo: [],
  historyLimit: 50,
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
  setExportBaseName: (name) => set({ exportBaseName: name }),
  setExportAsZip: (value) => set({ exportAsZip: value }),
  setExportStatus: (status) => set(status),
  pushHistory: (label) =>
    set((state) => {
      const snapshot: HistorySnapshot = {
        label,
        zones: cloneZones(state.zones),
        adjustments: cloneAdjustments(state.adjustments),
        selectedZoneIds: [...state.selectedZoneIds],
      };
      const history = [...state.history, snapshot];
      if (history.length > state.historyLimit) history.shift();
      return { history, redo: [] };
    }),
  undo: () =>
    set((state) => {
      if (state.history.length < 2) return {};
      const current = state.history[state.history.length - 1];
      const nextHistory = state.history.slice(0, -1);
      const previous = nextHistory[nextHistory.length - 1];
      return {
        zones: cloneZones(previous.zones),
        adjustments: cloneAdjustments(previous.adjustments),
        selectedZoneIds: [...previous.selectedZoneIds],
        history: nextHistory,
        redo: [current, ...state.redo],
      };
    }),
  redoAction: () =>
    set((state) => {
      if (state.redo.length === 0) return {};
      const next = state.redo[0];
      const nextHistory = [...state.history, next];
      return {
        zones: cloneZones(next.zones),
        adjustments: cloneAdjustments(next.adjustments),
        selectedZoneIds: [...next.selectedZoneIds],
        history: nextHistory,
        redo: state.redo.slice(1),
      };
    }),
  resetHistory: () => set({ history: [], redo: [] }),
}));

export const selectZones = (state: EditorState) => state.zones;
export const selectTool = (state: EditorState) => state.tool;
export const selectDrawing = (state: EditorState) => state.drawing;
export const selectImageInfo = (state: EditorState) => state.imageInfo;
export const selectCanvasMetrics = (state: EditorState) => state.canvasMetrics;
export const selectAdjustments = (state: EditorState) => state.adjustments;
export const selectCanUndo = (state: EditorState) => state.history.length > 1;
export const selectCanRedo = (state: EditorState) => state.redo.length > 0;
