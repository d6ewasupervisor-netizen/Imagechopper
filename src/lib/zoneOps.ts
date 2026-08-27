import { Point, Zone } from "../types/editor";

export const cloneZone = (zone: Zone, offset: Point = { x: 0, y: 0 }): Zone => {
  const id = crypto.randomUUID();
  if (zone.type === "polygon") {
    const points = zone.points.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    }));
    return {
      ...zone,
      id,
      points,
      x: zone.x + offset.x,
      y: zone.y + offset.y,
    };
  }
  return {
    ...zone,
    id,
    x: zone.x + offset.x,
    y: zone.y + offset.y,
  };
};

export const cloneZones = (zones: Zone[], offset: Point = { x: 0, y: 0 }) =>
  zones.map((zone) => cloneZone(zone, offset));

export const translateZone = (zone: Zone, dx: number, dy: number): Zone => {
  if (zone.type === "polygon") {
    const points = zone.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));
    return {
      ...zone,
      points,
      x: zone.x + dx,
      y: zone.y + dy,
    };
  }
  return {
    ...zone,
    x: zone.x + dx,
    y: zone.y + dy,
  };
};

export const clampZoneToImage = (
  zone: Zone,
  imageWidth: number,
  imageHeight: number
): Zone => {
  if (zone.type === "polygon") {
    let dx = 0;
    let dy = 0;
    if (zone.x < 0) dx = -zone.x;
    if (zone.y < 0) dy = -zone.y;
    if (zone.x + zone.width > imageWidth) dx = imageWidth - (zone.x + zone.width);
    if (zone.y + zone.height > imageHeight) {
      dy = imageHeight - (zone.y + zone.height);
    }
    if (dx === 0 && dy === 0) return zone;
    return translateZone(zone, dx, dy);
  }
  const width = Math.min(zone.width, imageWidth);
  const height = Math.min(zone.height, imageHeight);
  const x = Math.min(Math.max(zone.x, 0), imageWidth - width);
  const y = Math.min(Math.max(zone.y, 0), imageHeight - height);
  return { ...zone, x, y, width, height };
};

export const selectionBounds = (zones: Zone[]) => {
  if (zones.length === 0) return null;
  const minX = Math.min(...zones.map((zone) => zone.x));
  const minY = Math.min(...zones.map((zone) => zone.y));
  const maxX = Math.max(...zones.map((zone) => zone.x + zone.width));
  const maxY = Math.max(...zones.map((zone) => zone.y + zone.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type Bounds = { x: number; y: number; width: number; height: number };

export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

export const handlePositions = (bounds: Bounds) => {
  const { x, y, width, height } = bounds;
  const midX = x + width / 2;
  const midY = y + height / 2;
  return {
    nw: { x, y },
    n: { x: midX, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: midY },
    se: { x: x + width, y: y + height },
    s: { x: midX, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: midY },
  } as Record<ResizeHandle, Point>;
};

export const resizeBoundsByHandle = (
  bounds: Bounds,
  handle: ResizeHandle,
  pointer: Point,
  minSize = 8
): Bounds => {
  let { x, y, width, height } = bounds;
  const right = x + width;
  const bottom = y + height;

  if (handle.includes("e")) {
    width = Math.max(minSize, pointer.x - x);
  }
  if (handle.includes("s")) {
    height = Math.max(minSize, pointer.y - y);
  }
  if (handle.includes("w")) {
    const nextX = Math.min(pointer.x, right - minSize);
    width = right - nextX;
    x = nextX;
  }
  if (handle.includes("n")) {
    const nextY = Math.min(pointer.y, bottom - minSize);
    height = bottom - nextY;
    y = nextY;
  }
  if (handle === "n" || handle === "s") {
    // keep x/width
  }
  if (handle === "e" || handle === "w") {
    // keep y/height
  }

  return { x, y, width, height };
};

export const transformZoneAcrossBounds = (
  zone: Zone,
  from: Bounds,
  to: Bounds
): Zone => {
  if (from.width <= 0 || from.height <= 0) return zone;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const mapPoint = (point: Point): Point => ({
    x: to.x + (point.x - from.x) * sx,
    y: to.y + (point.y - from.y) * sy,
  });

  if (zone.type === "polygon") {
    const points = zone.points.map(mapPoint);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      ...zone,
      points,
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    };
  }

  return {
    ...zone,
    x: to.x + (zone.x - from.x) * sx,
    y: to.y + (zone.y - from.y) * sy,
    width: zone.width * sx,
    height: zone.height * sy,
  };
};

export const transformZonesAcrossBounds = (
  zones: Zone[],
  from: Bounds,
  to: Bounds
) => zones.map((zone) => transformZoneAcrossBounds(zone, from, to));

/** Scale every zone from the same handle (each keeps its own opposite corner). */
export const scaleZoneFromHandle = (
  zone: Zone,
  handle: ResizeHandle,
  sx: number,
  sy: number,
  minSize = 8
): Zone => {
  const axisX = handle === "n" || handle === "s" ? 1 : sx;
  const axisY = handle === "e" || handle === "w" ? 1 : sy;
  const safeSx = Number.isFinite(axisX) && axisX > 0 ? axisX : 1;
  const safeSy = Number.isFinite(axisY) && axisY > 0 ? axisY : 1;
  const width = Math.max(minSize, zone.width * safeSx);
  const height = Math.max(minSize, zone.height * safeSy);
  const right = zone.x + zone.width;
  const bottom = zone.y + zone.height;
  let x = zone.x;
  let y = zone.y;
  if (handle.includes("w")) x = right - width;
  if (handle.includes("n")) y = bottom - height;
  const nextBounds = { x, y, width, height };
  if (zone.type === "polygon") {
    return transformZoneAcrossBounds(zone, zone, nextBounds);
  }
  return { ...zone, ...nextBounds };
};

export const scaleZonesFromHandle = (
  zones: Zone[],
  handle: ResizeHandle,
  sx: number,
  sy: number,
  minSize = 8
) => zones.map((zone) => scaleZoneFromHandle(zone, handle, sx, sy, minSize));

export const rectsIntersect = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number }
) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

export const normalizeClientBox = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
) => ({
  left: Math.min(startX, endX),
  top: Math.min(startY, endY),
  width: Math.abs(endX - startX),
  height: Math.abs(endY - startY),
});
