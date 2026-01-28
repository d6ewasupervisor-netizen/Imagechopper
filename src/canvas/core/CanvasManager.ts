import { AdjustmentSettings, CanvasMetrics, Point, Zone } from "../../types/editor";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export class CanvasManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: HTMLImageElement | null = null;
  private metrics: CanvasMetrics | null = null;
  private adjustments: AdjustmentSettings = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
  };

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  setImage(image: HTMLImageElement | null) {
    this.image = image;
  }

  setAdjustments(adjustments: AdjustmentSettings) {
    this.adjustments = adjustments;
  }

  getMetrics() {
    return this.metrics;
  }

  render(viewportWidth: number, viewportHeight: number): CanvasMetrics | null {
    if (!this.canvas || !this.ctx || !this.image) return null;
    if (viewportWidth <= 0 || viewportHeight <= 0) return this.metrics;
    const padding = 40;
    const maxWidth = Math.max(0, viewportWidth - padding);
    const maxHeight = Math.max(0, viewportHeight - padding);
    if (maxWidth === 0 || maxHeight === 0) return this.metrics;
    const scale = Math.min(
      maxWidth / this.image.width,
      maxHeight / this.image.height,
      1
    );

    const displayWidth = Math.round(this.image.width * scale);
    const displayHeight = Math.round(this.image.height * scale);

    this.canvas.width = displayWidth;
    this.canvas.height = displayHeight;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
    this.ctx.filter = this.getFilterString();
    this.ctx.drawImage(this.image, 0, 0, displayWidth, displayHeight);
    this.ctx.filter = "none";

    this.metrics = { displayWidth, displayHeight, scale };
    return this.metrics;
  }

  clientToImagePoint(clientX: number, clientY: number): Point | null {
    if (!this.canvas || !this.image || !this.metrics) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / this.metrics.scale;
    const y = (clientY - rect.top) / this.metrics.scale;
    return {
      x: clamp(x, 0, this.image.width),
      y: clamp(y, 0, this.image.height),
    };
  }

  exportZones(zones: Zone[]) {
    if (!this.image || zones.length === 0) return [];
    return zones.map((zone, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(zone.width);
      canvas.height = Math.ceil(zone.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.filter = this.getFilterString();
      if (zone.type === "rect") {
        ctx.drawImage(
          this.image,
          zone.x,
          zone.y,
          zone.width,
          zone.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        ctx.save();
        ctx.beginPath();
        zone.points.forEach((point, idx) => {
          const px = point.x - zone.x;
          const py = point.y - zone.y;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          this.image,
          zone.x,
          zone.y,
          zone.width,
          zone.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        ctx.restore();
      }
      ctx.filter = "none";
      return {
        name: `zone_${String(index + 1).padStart(2, "0")}.png`,
        dataUrl: canvas.toDataURL("image/png"),
      };
    }).filter(Boolean) as { name: string; dataUrl: string }[];
  }

  private getFilterString() {
    const b = 100 + this.adjustments.brightness;
    const c = 100 + this.adjustments.contrast;
    const s = 100 + this.adjustments.saturation;
    const blur = this.adjustments.blur;
    return `brightness(${b}%) contrast(${c}%) saturate(${s}%) blur(${blur}px)`;
  }
}
