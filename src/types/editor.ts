export type ToolType = "select" | "rect" | "polygon" | "ellipse";

export interface Point {
  x: number;
  y: number;
}

export interface RectZone {
  id: string;
  type: "rect";
  label?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PolygonZone {
  id: string;
  type: "polygon";
  label?: string;
  color?: string;
  points: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseZone {
  id: string;
  type: "ellipse";
  label?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Zone = RectZone | PolygonZone | EllipseZone;

export interface DrawingRect {
  type: "rect";
  start: Point;
  current: Point;
}

export interface DrawingPolygon {
  type: "polygon";
  points: Point[];
  current?: Point | null;
}

export interface DrawingEllipse {
  type: "ellipse";
  start: Point;
  current: Point;
}

export type DrawingState = DrawingRect | DrawingPolygon | DrawingEllipse | null;

export interface CanvasMetrics {
  displayWidth: number;
  displayHeight: number;
  scale: number;
}

export interface ImageInfo {
  width: number;
  height: number;
}

export interface AdjustmentSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}
