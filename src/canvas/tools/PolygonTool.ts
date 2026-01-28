import { DrawingPolygon, Point } from "../../types/editor";
import { ZoneTool, ZoneToolContext } from "./ZoneTool";

export class PolygonTool implements ZoneTool {
  onPointerDown(point: Point, context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (!drawing || drawing.type !== "polygon") {
      const next: DrawingPolygon = { type: "polygon", points: [point], current: null };
      context.setDrawing(next);
      return;
    }
    const first = drawing.points[0];
    const closeEnough = Math.hypot(first.x - point.x, first.y - point.y) < 12;
    if (closeEnough && drawing.points.length >= 3) {
      this.finalize(context);
      return;
    }
    context.setDrawing({
      ...drawing,
      points: [...drawing.points, point],
    });
  }

  onPointerMove(point: Point, context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (!drawing || drawing.type !== "polygon") return;
    context.setDrawing({ ...drawing, current: point });
  }

  onPointerUp(_: Point, context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (drawing && drawing.type === "polygon") {
      context.setDrawing({ ...drawing, current: null });
    }
  }

  onDoubleClick(_: Point, context: ZoneToolContext) {
    this.finalize(context);
  }

  private finalize(context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (!drawing || drawing.type !== "polygon") return;
    if (drawing.points.length < 3) {
      context.setDrawing(null);
      return;
    }
    const xs = drawing.points.map((p) => p.x);
    const ys = drawing.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    context.addZone({
      id: crypto.randomUUID(),
      type: "polygon",
      points: drawing.points,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
    context.setDrawing(null);
  }
}
