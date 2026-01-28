import { useEffect, useRef, useState } from "react";
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
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const imageInfo = useEditorStore((state) => state.imageInfo);
  const canvasMetrics = useEditorStore((state) => state.canvasMetrics);
  const exportBaseName = useEditorStore((state) => state.exportBaseName);
  const setExportBaseName = useEditorStore((state) => state.setExportBaseName);
  const exportAsZip = useEditorStore((state) => state.exportAsZip);
  const setExportAsZip = useEditorStore((state) => state.setExportAsZip);
  const isExporting = useEditorStore((state) => state.isExporting);
  const exportProgress = useEditorStore((state) => state.exportProgress);
  const exportStatus = useEditorStore((state) => state.exportStatus);
  const setExportAbort = useEditorStore((state) => state.setExportAbort);
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

  const updateSelectedZone = (field: "x" | "y" | "width" | "height", value: number) => {
    if (!selectedZone || Number.isNaN(value)) return;
    updateZone(selectedZone.id, { [field]: value });
  };

  const zoomPercent = Math.round(zoom * 100);
  const selectedCount = selectedZoneIds.length;
  const outputCountLabel = `${zones.length} outputs · Format: PNG`;
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
    isExporting,
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
                  {selectedZone && (
                    <div className="zone-inspector">
                      <div className="section-title">Selected zone</div>
                      <div className="zone-inspector-grid">
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
                            Zone {index + 1} · {zone.type}
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
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={exportAsZip}
                      onChange={(event) => setExportAsZip(event.target.checked)}
                    />
                    Download as ZIP
                  </label>
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
                  <div className="section-title">Contact</div>
                  <div className="hint">Email: support@imagechopper.app</div>
                  <div className="hint">Feedback: https://imagechopper.app/feedback</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Subscription</div>
                  <div className="hint">
                    Free: up to 10 zones per image. Pro: unlimited zones + ZIP exports.
                  </div>
                  <button className="btn small primary">Upgrade to Pro</button>
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
                  <div className="help-item">Polygon: P</div>
                </div>
                <div className="help-section">
                  <div className="section-title">Editing</div>
                  <div className="help-item">Undo: Ctrl/Cmd + Z</div>
                  <div className="help-item">Redo: Ctrl/Cmd + Y or Shift + Z</div>
                  <div className="help-item">Delete selection: Delete/Backspace</div>
                  <div className="help-item">Cancel drawing: Esc</div>
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
