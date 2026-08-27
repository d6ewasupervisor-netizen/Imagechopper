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
