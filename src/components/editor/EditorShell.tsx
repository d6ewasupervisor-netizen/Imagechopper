import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CanvasWorkspace from "./CanvasWorkspace";
import { useEditor } from "../../context/EditorContext";
import {
  selectCanRedo,
  selectCanUndo,
  useEditorStore,
} from "../../store/useEditorStore";

type TabId =
  | "tools"
  | "templates"
  | "ratios"
  | "adjustments"
  | "zones"
  | "export"
  | "actions"
  | "help";

const EditorShell = () => {
  const [activeTab, setActiveTab] = useState<TabId>("tools");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const imageInfo = useEditorStore((state) => state.imageInfo);
  const canvasMetrics = useEditorStore((state) => state.canvasMetrics);
  const exportBaseName = useEditorStore((state) => state.exportBaseName);
  const setExportBaseName = useEditorStore((state) => state.setExportBaseName);
  const exportFormat = useEditorStore((state) => state.exportFormat);
  const setExportFormat = useEditorStore((state) => state.setExportFormat);
  const exportQuality = useEditorStore((state) => state.exportQuality);
  const setExportQuality = useEditorStore((state) => state.setExportQuality);
  const exportNamePattern = useEditorStore((state) => state.exportNamePattern);
  const setExportNamePattern = useEditorStore((state) => state.setExportNamePattern);
  const exportAsZip = useEditorStore((state) => state.exportAsZip);
  const setExportAsZip = useEditorStore((state) => state.setExportAsZip);
  const isExporting = useEditorStore((state) => state.isExporting);
  const exportProgress = useEditorStore((state) => state.exportProgress);
  const exportStatus = useEditorStore((state) => state.exportStatus);
  const setExportAbort = useEditorStore((state) => state.setExportAbort);
  const isPro = useEditorStore((state) => state.isPro);
  const maxFreeZones = useEditorStore((state) => state.maxFreeZones);
  const setIsPro = useEditorStore((state) => state.setIsPro);
  const adjustments = useEditorStore((state) => state.adjustments);
  const setAdjustment = useEditorStore((state) => state.setAdjustment);
  const resetAdjustments = useEditorStore((state) => state.resetAdjustments);
  const zones = useEditorStore((state) => state.zones);
  const selectedZoneIds = useEditorStore((state) => state.selectedZoneIds);
  const setZones = useEditorStore((state) => state.setZones);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const setDrawing = useEditorStore((state) => state.setDrawing);
  const clearZones = useEditorStore((state) => state.clearZones);
  const updateZone = useEditorStore((state) => state.updateZone);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const resetPan = useEditorStore((state) => state.resetPan);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redoAction);
  const { actions } = useEditor();

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const deleteZone = (id: string) => {
    setZones(zones.filter((zone) => zone.id !== id));
    setSelectedZoneIds(selectedZoneIds.filter((zoneId) => zoneId !== id));
    pushHistory("Delete zone");
  };

  const selectedZone =
    selectedZoneIds.length === 1
      ? zones.find((zone) => zone.id === selectedZoneIds[0]) ?? null
      : null;

  const updateSelectedZone = (
    field: "x" | "y" | "width" | "height" | "label" | "color",
    value: number | string
  ) => {
    if (!selectedZone) return;
    if (typeof value === "number" && Number.isNaN(value)) return;
    updateZone(selectedZone.id, { [field]: value });
  };

  const computeBounds = (points: { x: number; y: number }[]) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const nudgeSelectedZones = (dx: number, dy: number) => {
    if (!imageInfo || selectedZoneIds.length === 0) return;
    const nextZones = zones.map((zone) => {
      if (!selectedZoneIds.includes(zone.id)) return zone;
      if (zone.type === "rect" || zone.type === "ellipse") {
        const nextX = Math.min(Math.max(zone.x + dx, 0), imageInfo.width - zone.width);
        const nextY = Math.min(Math.max(zone.y + dy, 0), imageInfo.height - zone.height);
        return { ...zone, x: nextX, y: nextY };
      }
      const shiftedPoints = zone.points.map((point) => ({
        x: point.x + dx,
        y: point.y + dy,
      }));
      let bounds = computeBounds(shiftedPoints);
      let snapX = 0;
      let snapY = 0;
      if (bounds.x < 0) snapX = -bounds.x;
      if (bounds.y < 0) snapY = -bounds.y;
      if (bounds.x + bounds.width > imageInfo.width) {
        snapX = imageInfo.width - (bounds.x + bounds.width);
      }
      if (bounds.y + bounds.height > imageInfo.height) {
        snapY = imageInfo.height - (bounds.y + bounds.height);
      }
      const finalPoints = shiftedPoints.map((point) => ({
        x: point.x + snapX,
        y: point.y + snapY,
      }));
      bounds = computeBounds(finalPoints);
      return { ...zone, points: finalPoints, ...bounds };
    });
    setZones(nextZones);
    pushHistory("Nudge zones");
  };

  const zoomPercent = Math.round(zoom * 100);
  const selectedCount = selectedZoneIds.length;
  const formatLabel = exportFormat.replace("image/", "").toUpperCase();
  const outputCountLabel = `${zones.length} outputs · Format: ${formatLabel}`;
  const planLabel = isPro ? "Pro" : "Free";

  const handleUpgrade = () => {
    toast.message("Upgrade flow coming soon.");
  };

  const handleProjectOpen = () => {
    projectInputRef.current?.click();
  };

  const namePresets = [
    { id: "base-index", label: "Base + Index", pattern: "{base}_{index}" },
    { id: "label-index", label: "Label + Index", pattern: "{label}_{index}" },
    { id: "base-label", label: "Base + Label", pattern: "{base}_{label}" },
    { id: "base-size", label: "Base + Size", pattern: "{base}_{w}x{h}" },
  ];

  const selectedPreset =
    namePresets.find((preset) => preset.pattern === exportNamePattern)?.id ?? "custom";
  const adjustZoom = (delta: number) => {
    const next = Math.min(4, Math.max(0.25, Math.round((zoom + delta) * 100) / 100));
    setZoom(next);
  };

  const handleFit = () => {
    setZoom(1);
    resetPan();
  };

  const handleZoom100 = () => {
    if (canvasMetrics?.scale) {
      const next = Math.min(4, Math.max(0.25, Math.round((1 / canvasMetrics.scale) * 100) / 100));
      setZoom(next);
    } else {
      setZoom(1);
    }
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const isMod = event.ctrlKey || event.metaKey;

      if (isMod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) undo();
        return;
      }

      if (isMod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (isMod && key === "o") {
        event.preventDefault();
        handleOpen();
        return;
      }

      if (isMod && key === "e") {
        event.preventDefault();
        if (!isExporting) {
          void actions.exportZones();
        }
        return;
      }

      if (key === "v") {
        setTool("select");
        return;
      }

      if (key === "r") {
        setTool("rect");
        return;
      }

      if (key === "e") {
        setTool("ellipse");
        return;
      }

      if (key === "p") {
        setTool("polygon");
        return;
      }

      if (key === "escape") {
        setDrawing(null);
        setSelectedZoneIds([]);
        return;
      }

      if (key === "?") {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        if (!imageInfo || selectedZoneIds.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (key === "arrowup") nudgeSelectedZones(0, -step);
        if (key === "arrowdown") nudgeSelectedZones(0, step);
        if (key === "arrowleft") nudgeSelectedZones(-step, 0);
        if (key === "arrowright") nudgeSelectedZones(step, 0);
        return;
      }

      if (key === "backspace" || key === "delete") {
        if (selectedZoneIds.length === 0) return;
        event.preventDefault();
        setZones(zones.filter((zone) => !selectedZoneIds.includes(zone.id)));
        setSelectedZoneIds([]);
        pushHistory("Delete zones");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    actions,
    canRedo,
    canUndo,
    handleOpen,
    imageInfo,
    isExporting,
    nudgeSelectedZones,
    pushHistory,
    redo,
    selectedZoneIds,
    setDrawing,
    setSelectedZoneIds,
    setTool,
    setZones,
    undo,
    zones,
  ]);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("imagechopper_tutorial_seen");
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      localStorage.setItem("imagechopper_tutorial_seen", "true");
    }
  }, []);

  useEffect(() => {
    if (!isPro && exportFormat !== "image/png") {
      setExportFormat("image/png");
    }
  }, [isPro, exportFormat, setExportFormat]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ImageChopper Studio</div>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </button>
          <button className="btn ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Y)">
            Redo
          </button>
          <button className="btn ghost" onClick={handleOpen} title="Open Image (Ctrl/Cmd+O)">
            Open
          </button>
          <button className="btn ghost" onClick={() => setShowHelp(true)} title="Help">
            Help
          </button>
          <button
            className="btn ghost"
            onClick={() => setShowShortcuts(true)}
            title="Shortcuts (?)"
          >
            ?
          </button>
          <div className="plan-pill" title="Current plan">
            {planLabel}
          </div>
          {!isPro && (
            <button className="btn primary" onClick={handleUpgrade} title="Upgrade">
              Upgrade
            </button>
          )}
        </div>
      </header>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            try {
              await actions.loadImageFromFile(file);
            } catch {
              // handled via toast
            }
          }
          event.target.value = "";
        }}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            try {
              await actions.loadProjectFromFile(file);
            } catch {
              // handled via toast
            }
          }
          event.target.value = "";
        }}
      />

      <div className="tool-bar">
        <div className="tool-bar-section">
          <button
            className={`tool-pill ${tool === "select" ? "active" : ""}`}
            onClick={() => setTool("select")}
            title="Select (V)"
          >
            Select
          </button>
          <button
            className={`tool-pill ${tool === "rect" ? "active" : ""}`}
            onClick={() => setTool("rect")}
            title="Rectangle (R)"
          >
            Rectangle
          </button>
          <button
            className={`tool-pill ${tool === "ellipse" ? "active" : ""}`}
            onClick={() => setTool("ellipse")}
            title="Ellipse (E)"
          >
            Ellipse
          </button>
          <button
            className={`tool-pill ${tool === "polygon" ? "active" : ""}`}
            onClick={() => setTool("polygon")}
            title="Polygon (P)"
          >
            Polygon
          </button>
        </div>
        <div className="tool-bar-section">
          <button className="btn small ghost" onClick={() => adjustZoom(-0.1)} title="Zoom out">
            -
          </button>
          <div className="zoom-label">{zoomPercent}%</div>
          <button className="btn small ghost" onClick={() => adjustZoom(0.1)} title="Zoom in">
            +
          </button>
          <button className="btn small ghost" onClick={handleFit} title="Fit to screen">
            Fit
          </button>
          <button className="btn small ghost" onClick={handleZoom100} title="Zoom to 100%">
            100%
          </button>
          <button className="btn small ghost" onClick={resetPan} title="Reset pan">
            Reset Pan
          </button>
          <span className="hint">Hold Space to pan</span>
        </div>
      </div>

      {!isPro && (
        <div className="ad-strip">
          <span className="ad-label">Sponsored</span>
          <span>Try ImageChopper Pro for ad-free editing and premium exports.</span>
          <button className="btn small primary" onClick={handleUpgrade}>
            Go Pro
          </button>
        </div>
      )}

      <div className="workspace">
        <main className="canvas-pane">
          <CanvasWorkspace onOpenImage={handleOpen} />
          <div className="bottom-tabs">
            <div className="tab-strip" role="tablist" aria-label="Editor menu tabs">
              {[
                { id: "tools", label: "Tools" },
                { id: "templates", label: "Templates" },
                { id: "ratios", label: "Ratios" },
                { id: "adjustments", label: "Adjustments" },
                { id: "zones", label: "Zones" },
                { id: "export", label: "Export" },
                { id: "actions", label: "Actions" },
                { id: "help", label: "Help" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => {
                    if (tab.id === "help") {
                      setShowHelp(true);
                      return;
                    }
                    setActiveTab(tab.id as TabId);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="tab-panel">
              {activeTab === "tools" && (
                <div className="tab-content-grid">
                  <button
                    className={`tab-action ${tool === "select" ? "active" : ""}`}
                    onClick={() => setTool("select")}
                  >
                    Select
                  </button>
                  <button
                    className={`tab-action ${tool === "rect" ? "active" : ""}`}
                    onClick={() => setTool("rect")}
                  >
                    Rectangle
                  </button>
                  <button
                    className={`tab-action ${tool === "ellipse" ? "active" : ""}`}
                    onClick={() => setTool("ellipse")}
                  >
                    Ellipse
                  </button>
                  <button
                    className={`tab-action ${tool === "polygon" ? "active" : ""}`}
                    onClick={() => setTool("polygon")}
                  >
                    Polygon
                  </button>
                </div>
              )}

              {activeTab === "templates" && (
                <div className="tab-content-grid">
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("rule-thirds")}
                  >
                    Rule of Thirds
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("golden-ratio")}
                  >
                    Golden Ratio
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("grid-2x2")}
                  >
                    Grid 2x2
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("grid-3x2")}
                  >
                    Grid 3x2
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("grid-2x3")}
                  >
                    Grid 2x3
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("grid-4x2")}
                  >
                    Grid 4x2
                  </button>
                  <button
                    className="tab-action"
                    disabled={!imageInfo}
                    onClick={() => actions.applyTemplate("grid-2x4")}
                  >
                    Grid 2x4
                  </button>
                </div>
              )}

              {activeTab === "ratios" && (
                <div className="tab-content-grid">
                  {["1:1", "4:3", "3:2", "16:9", "9:16"].map((ratio) => (
                    <button
                      key={ratio}
                      className="tab-action"
                      disabled={!imageInfo}
                      onClick={() => actions.applyRatio(ratio)}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "adjustments" && (
                <div className="adjustments-grid">
                  <div className="hint">Adjustments apply to preview and exports.</div>
                  {([
                    { key: "brightness", label: "Brightness", min: -50, max: 50 },
                    { key: "contrast", label: "Contrast", min: -50, max: 50 },
                    { key: "saturation", label: "Saturation", min: -50, max: 50 },
                    { key: "blur", label: "Blur", min: 0, max: 12 },
                  ] as const).map(({ key, label, min, max }) => (
                    <div key={key} className="adjustment-card">
                      <div className="hint adjustment-header">
                        <span>{label}</span>
                        <span>{adjustments[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={adjustments[key]}
                        onChange={(event) => setAdjustment(key, Number(event.target.value))}
                        onMouseUp={() => pushHistory("Adjustments updated")}
                        onTouchEnd={() => pushHistory("Adjustments updated")}
                      />
                    </div>
                  ))}
                  <button
                    className="tab-action"
                    onClick={() => {
                      resetAdjustments();
                      pushHistory("Reset adjustments");
                    }}
                  >
                    Reset Adjustments
                  </button>
                </div>
              )}

              {activeTab === "zones" && (
                <div className="zones-panel">
                  <div className="hint">
                    {selectedCount > 0
                      ? `${selectedCount} selected · ${zones.length} total`
                      : `${zones.length} total zones`}
                  </div>
                  {!isPro && (
                    <div className="hint">
                      Free plan limit: {maxFreeZones} zones.{" "}
                      <button className="link-button" onClick={handleUpgrade}>
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                  {selectedZone && (
                    <div className="zone-inspector">
                      <div className="section-title">Selected zone</div>
                      <div className="zone-inspector-grid">
                        <label className="menu-label" htmlFor="zone-label">
                          Label
                        </label>
                        <input
                          id="zone-label"
                          className="menu-input"
                          type="text"
                          value={selectedZone.label ?? ""}
                          onChange={(event) => updateSelectedZone("label", event.target.value)}
                          onBlur={() => pushHistory("Update zone")}
                        />
                        <label className="menu-label" htmlFor="zone-color">
                          Color
                        </label>
                        <input
                          id="zone-color"
                          className="menu-input"
                          type="color"
                          value={selectedZone.color ?? "#60a5fa"}
                          onChange={(event) =>
                            updateSelectedZone("color", event.target.value.toLowerCase())
                          }
                          onBlur={() => pushHistory("Update zone")}
                        />
                        <label className="menu-label" htmlFor="zone-x">
                          X
                        </label>
                        <input
                          id="zone-x"
                          className="menu-input"
                          type="number"
                          value={Math.round(selectedZone.x)}
                          onChange={(event) => updateSelectedZone("x", Number(event.target.value))}
                          onBlur={() => pushHistory("Update zone")}
                        />
                        <label className="menu-label" htmlFor="zone-y">
                          Y
                        </label>
                        <input
                          id="zone-y"
                          className="menu-input"
                          type="number"
                          value={Math.round(selectedZone.y)}
                          onChange={(event) => updateSelectedZone("y", Number(event.target.value))}
                          onBlur={() => pushHistory("Update zone")}
                        />
                        <label className="menu-label" htmlFor="zone-w">
                          Width
                        </label>
                        <input
                          id="zone-w"
                          className="menu-input"
                          type="number"
                          value={Math.round(selectedZone.width)}
                          onChange={(event) =>
                            updateSelectedZone("width", Number(event.target.value))
                          }
                          onBlur={() => pushHistory("Update zone")}
                        />
                        <label className="menu-label" htmlFor="zone-h">
                          Height
                        </label>
                        <input
                          id="zone-h"
                          className="menu-input"
                          type="number"
                          value={Math.round(selectedZone.height)}
                          onChange={(event) =>
                            updateSelectedZone("height", Number(event.target.value))
                          }
                          onBlur={() => pushHistory("Update zone")}
                        />
                      </div>
                    </div>
                  )}
                  <div className="zones-list">
                    {zones.length === 0 ? (
                      <div className="hint">No zones yet. Use a shape tool to create selections.</div>
                    ) : (
                      zones.map((zone, index) => (
                        <div
                          key={zone.id}
                          className={`zone-item ${selectedZoneIds.includes(zone.id) ? "active" : ""}`}
                        >
                          <div>
                            <span className="zone-label">
                              <span
                                className="zone-color-dot"
                                style={{ background: zone.color ?? "#94a3b8" }}
                              />
                              {zone.label || `Zone ${index + 1}`}
                            </span>{" "}
                            · {zone.type}
                            <div className="hint">
                              {Math.round(zone.width)} x {Math.round(zone.height)}
                            </div>
                          </div>
                          <button className="btn small danger" onClick={() => deleteZone(zone.id)}>
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="tab-content-grid">
                    <button className="tab-action" onClick={() => setSelectedZoneIds([])}>
                      Clear Selection
                    </button>
                    <button
                      className="tab-action danger"
                      onClick={() => {
                        clearZones();
                        pushHistory("Clear zones");
                      }}
                    >
                      Clear Zones
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "export" && (
                <div className="tab-content-grid">
                  <div className="hint">{outputCountLabel}</div>
                  <label className="menu-label" htmlFor="exportPreset">
                    Naming preset
                  </label>
                  <select
                    id="exportPreset"
                    className="menu-input"
                    value={selectedPreset}
                    onChange={(event) => {
                      const preset = namePresets.find((item) => item.id === event.target.value);
                      if (preset) {
                        setExportNamePattern(preset.pattern);
                      }
                    }}
                    disabled={!isPro}
                  >
                    {namePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                  <label className="menu-label" htmlFor="exportPattern">
                    Naming pattern
                  </label>
                  <input
                    id="exportPattern"
                    className="menu-input"
                    type="text"
                    value={exportNamePattern}
                    onChange={(event) => setExportNamePattern(event.target.value)}
                    disabled={!isPro}
                  />
                  <div className="hint">
                    Tokens: {"{base}"} {"{index}"} {"{label}"} {"{w}"} {"{h}"}
                  </div>
                  <label className="menu-label" htmlFor="exportBaseName">
                    Base filename
                  </label>
                  <input
                    id="exportBaseName"
                    className="menu-input"
                    type="text"
                    placeholder="custom"
                    value={exportBaseName}
                    onChange={(event) => setExportBaseName(event.target.value)}
                  />
                  <div className="hint">Outputs: custom_01, custom_02, ...</div>
                  <button
                    className="tab-action"
                    onClick={actions.exportZones}
                    disabled={zones.length === 0 || isExporting}
                  >
                    {isExporting ? "Exporting..." : "Export Zones"}
                  </button>
                  <div className="hint">Shortcut: Ctrl/Cmd + E</div>
                  {isExporting && (
                    <button className="tab-action danger" onClick={() => setExportAbort(true)}>
                      Cancel Export
                    </button>
                  )}
                  <label className="menu-label" htmlFor="exportFormat">
                    Format
                  </label>
                  <select
                    id="exportFormat"
                    className="menu-input"
                    value={exportFormat}
                    onChange={(event) =>
                      setExportFormat(event.target.value as "image/png" | "image/jpeg" | "image/webp")
                    }
                    disabled={!isPro}
                  >
                    <option value="image/png">PNG (Free)</option>
                    <option value="image/jpeg">JPEG (Pro)</option>
                    <option value="image/webp">WebP (Pro)</option>
                  </select>
                  {!isPro && (
                    <div className="hint">
                      JPEG/WebP exports are Pro features.{" "}
                      <button className="link-button" onClick={handleUpgrade}>
                        Upgrade
                      </button>
                    </div>
                  )}
                  {(exportFormat === "image/jpeg" || exportFormat === "image/webp") && (
                    <>
                      <label className="menu-label" htmlFor="exportQuality">
                        Quality
                      </label>
                      <input
                        id="exportQuality"
                        type="range"
                        min={0.5}
                        max={1}
                        step={0.05}
                        value={exportQuality}
                        onChange={(event) => setExportQuality(Number(event.target.value))}
                      />
                      <div className="hint">{Math.round(exportQuality * 100)}% quality</div>
                    </>
                  )}
                  <button
                    className="tab-action"
                    onClick={actions.exportMetadata}
                    disabled={!isPro}
                  >
                    Download Metadata {isPro ? "" : "(Pro)"}
                  </button>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={exportAsZip}
                      disabled={!isPro}
                      onChange={(event) => setExportAsZip(event.target.checked)}
                    />
                    Download as ZIP {isPro ? "" : "(Pro)"}
                  </label>
                  {!isPro && (
                    <div className="hint">
                      ZIP + naming presets + metadata exports are Pro features.{" "}
                      <button className="link-button" onClick={handleUpgrade}>
                        Upgrade
                      </button>
                    </div>
                  )}
                  {isExporting && (
                    <div className="export-progress">
                      <div className="export-progress-label">
                        Exporting {Math.round(exportProgress * 100)}%
                      </div>
                      <div className="export-progress-track">
                        <div
                          className="export-progress-bar"
                          style={{ width: `${Math.round(exportProgress * 100)}%` }}
                        />
                      </div>
                      {exportStatus && <div className="hint">{exportStatus}</div>}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "actions" && (
                <div className="tab-content-grid">
                  <button className="tab-action" onClick={undo} disabled={!canUndo}>
                    Undo
                  </button>
                  <button className="tab-action" onClick={redo} disabled={!canRedo}>
                    Redo
                  </button>
                  <button className="tab-action" onClick={handleOpen}>
                    Open Image
                  </button>
                  <button className="tab-action" onClick={actions.saveProject} disabled={!isPro}>
                    Save Project {isPro ? "" : "(Pro)"}
                  </button>
                  <button className="tab-action" onClick={handleProjectOpen} disabled={!isPro}>
                    Load Project {isPro ? "" : "(Pro)"}
                  </button>
                  <button className="tab-action" onClick={actions.exportMetadata} disabled={!isPro}>
                    Download Metadata {isPro ? "" : "(Pro)"}
                  </button>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {showTutorial && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Welcome to ImageChopper Studio</div>
              <button className="btn small ghost" onClick={() => setShowTutorial(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <ol className="help-list">
                <li>Open an image or drop one onto the canvas.</li>
                <li>Choose Rectangle or Polygon to create zones.</li>
                <li>Use Select to move zones or adjust them.</li>
                <li>Drag near edges to snap for precision.</li>
                <li>Try Templates or Ratios to speed up layout.</li>
                <li>Export zones as individual files or ZIP.</li>
              </ol>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setShowTutorial(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop">
          <div className="modal modal-scrollable">
            <div className="modal-header">
              <div className="modal-title">Help &amp; Resources</div>
              <button className="btn small ghost" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="help-panel">
                <div className="help-section">
                  <div className="section-title">Quick tutorial</div>
                  <ol className="help-list">
                    <li>Open an image or drop one into the canvas.</li>
                    <li>Pick Rectangle or Polygon to create zones.</li>
                    <li>Drag zones to reposition; use Select to move.</li>
                    <li>Drag near edges to snap for precision.</li>
                    <li>Adjust brightness/contrast if needed.</li>
                    <li>Export zones as individual files or ZIP.</li>
                  </ol>
                  <button className="btn small ghost" onClick={() => setShowTutorial(true)}>
                    Replay tutorial
                  </button>
                </div>
                <div className="help-section">
                  <div className="section-title">FAQ</div>
                  <div className="help-item">
                    <strong>Why do my zones look slightly off?</strong>
                    <div className="hint">
                      Zoom levels and image scaling can affect precision. Use Select and drag
                      for fine adjustments.
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Can I export everything at once?</strong>
                    <div className="hint">Yes. Enable “Download as ZIP” and use Export Zones.</div>
                  </div>
                  <div className="help-item">
                    <strong>What image formats are supported?</strong>
                    <div className="hint">
                      Most common formats work (PNG, JPG, WebP). Large images may take longer.
                    </div>
                  </div>
                </div>
                <div className="help-section">
                  <div className="section-title">CSS cropping recipes</div>
                  <div className="help-item">
                    <strong>Overflow crop</strong>
                    <div className="hint">
                      Wrap an image in a fixed-size container and use <code>overflow: hidden</code> to
                      clip it.
                    </div>
                    <div className="hint">
                      <code>{".wrap { width: 400px; height: 400px; overflow: hidden; }"}</code>
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Object-fit crop</strong>
                    <div className="hint">
                      Use <code>object-fit: cover</code> with <code>object-position</code> to focus the
                      crop.
                    </div>
                    <div className="hint">
                      <code>{".cropped { width: 150px; height: 150px; object-fit: cover; object-position: 25% 25%; }"}</code>
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Aspect ratio crop</strong>
                    <div className="hint">
                      Use <code>padding-top</code> + <code>calc()</code> to lock aspect ratio, then
                      cover the box.
                    </div>
                    <div className="hint">
                      <code>{".image-box { height: 0; padding-top: calc(100% * (100 / 300)); position: relative; }"}</code>
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Transform crop</strong>
                    <div className="hint">
                      Combine <code>transform: scale()</code> + <code>translate()</code> for precise
                      framing.
                    </div>
                    <div className="hint">
                      <code>{".image { object-fit: cover; transform: scale(0.5) translate(0, 5%); }"}</code>
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Clip-path crop</strong>
                    <div className="hint">
                      Use <code>clip-path</code> for custom shapes (rectangle, circle, polygon).
                    </div>
                    <div className="hint">
                      <code>{".clip { clip-path: inset(20px 50px 10px 0 round 50px); }"}</code>
                    </div>
                  </div>
                </div>
                <div className="help-section">
                  <div className="section-title">CSS crop tips</div>
                  <div className="help-item">
                    <strong>Responsive containers</strong>
                    <div className="hint">
                      Prefer <code>object-fit: cover</code> for centered responsive crops.
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Fine-tune with margins</strong>
                    <div className="hint">
                      When using <code>overflow: hidden</code>, use negative margins to shift focus.
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Fallback styles</strong>
                    <div className="hint">
                      Pair modern methods with <code>overflow</code> fallbacks for older browsers.
                    </div>
                  </div>
                  <div className="help-item">
                    <strong>Performance</strong>
                    <div className="hint">
                      CSS crops do not reduce file size. Pre-crop on the server when possible.
                    </div>
                  </div>
                </div>
                <div className="help-section">
                  <div className="section-title">Contact</div>
                  <div className="hint">Email: support@imagechopper.app</div>
                  <div className="hint">Feedback: https://imagechopper.app/feedback</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Subscription</div>
                  <div className="hint">
                    Free: up to {maxFreeZones} zones per image, PNG exports, and light ads. Pro:
                    unlimited zones, JPEG/WebP, ZIP exports, metadata + project files, and no ads.
                  </div>
                  <button className="btn small primary" onClick={handleUpgrade}>
                    Upgrade to Pro
                  </button>
                  <button className="btn small ghost" onClick={() => setIsPro(!isPro)}>
                    Toggle Pro (preview)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Keyboard shortcuts</div>
              <button className="btn small ghost" onClick={() => setShowShortcuts(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="help-panel">
                <div className="help-section">
                  <div className="section-title">Tools</div>
                  <div className="help-item">Select: V</div>
                  <div className="help-item">Rectangle: R</div>
                  <div className="help-item">Ellipse: E</div>
                  <div className="help-item">Polygon: P</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Editing</div>
                  <div className="help-item">Undo: Ctrl/Cmd + Z</div>
                  <div className="help-item">Redo: Ctrl/Cmd + Y or Shift + Z</div>
                  <div className="help-item">Delete selection: Delete/Backspace</div>
                  <div className="help-item">Cancel drawing: Esc</div>
                  <div className="help-item">Nudge selection: Arrow keys (Shift = 10px)</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Files</div>
                  <div className="help-item">Open image: Ctrl/Cmd + O</div>
                  <div className="help-item">Export zones: Ctrl/Cmd + E</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Canvas</div>
                  <div className="help-item">Pan: Hold Space + drag</div>
                  <div className="help-item">Zoom: Use toolbar buttons</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setShowShortcuts(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorShell;
