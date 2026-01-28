import { DrawingEllipse, Point } from "../../types/editor";
import { ZoneTool, ZoneToolContext } from "./ZoneTool";

export class EllipseTool implements ZoneTool {
  onPointerDown(point: Point, context: ZoneToolContext) {
    const drawing: DrawingEllipse = { type: "ellipse", start: point, current: point };
    context.setDrawing(drawing);
  }

  onPointerMove(point: Point, context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (!drawing || drawing.type !== "ellipse") return;
    context.setDrawing({ ...drawing, current: point });
  }

  onPointerUp(point: Point, context: ZoneToolContext) {
    const drawing = context.getDrawing();
    if (!drawing || drawing.type !== "ellipse") return;
    const x = Math.min(drawing.start.x, point.x);
    const y = Math.min(drawing.start.y, point.y);
    const width = Math.abs(drawing.start.x - point.x);
    const height = Math.abs(drawing.start.y - point.y);
    if (width < 8 || height < 8) {
      context.setDrawing(null);
      return;
    }
    context.addZone({
      id: crypto.randomUUID(),
      type: "ellipse",
      x,
      y,
      width,
      height,
    });
    context.pushHistory("Add ellipse");
    context.setDrawing(null);
  }
}
