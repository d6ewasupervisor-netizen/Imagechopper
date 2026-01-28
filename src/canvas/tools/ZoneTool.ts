import { DrawingState, Point, Zone } from "../../types/editor";

export interface ZoneToolContext {
  getZones: () => Zone[];
  setZones: (zones: Zone[]) => void;
  addZone: (zone: Zone) => void;
  setSelectedZoneIds: (ids: string[]) => void;
  getDrawing: () => DrawingState;
  setDrawing: (drawing: DrawingState) => void;
  getImageSize: () => { width: number; height: number } | null;
}

export interface ZoneTool {
  onPointerDown: (point: Point, context: ZoneToolContext) => void;
  onPointerMove: (point: Point, context: ZoneToolContext) => void;
  onPointerUp: (point: Point, context: ZoneToolContext) => void;
  onDoubleClick?: (point: Point, context: ZoneToolContext) => void;
}
