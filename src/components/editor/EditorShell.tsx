import { useRef, useState } from "react";
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
  | "actions";

const EditorShell = () => {
  const [activeTab, setActiveTab] = useState<TabId>("tools");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const imageInfo = useEditorStore((state) => state.imageInfo);
  const exportBaseName = useEditorStore((state) => state.exportBaseName);
  const setExportBaseName = useEditorStore((state) => state.setExportBaseName);
  const adjustments = useEditorStore((state) => state.adjustments);
  const setAdjustment = useEditorStore((state) => state.setAdjustment);
  const resetAdjustments = useEditorStore((state) => state.resetAdjustments);
  const zones = useEditorStore((state) => state.zones);
  const selectedZoneIds = useEditorStore((state) => state.selectedZoneIds);
  const setZones = useEditorStore((state) => state.setZones);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const clearZones = useEditorStore((state) => state.clearZones);
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ImageChopper Studio</div>
      </header>

      <div className="workspace">
        <main className="canvas-pane">
          <CanvasWorkspace />
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
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
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
                    disabled={zones.length === 0}
                  >
                    Export Zones
                  </button>
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        await actions.loadImageFromFile(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditorShell;
