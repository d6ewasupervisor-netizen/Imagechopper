import CanvasWorkspace from "./CanvasWorkspace";
import Inspector from "./Inspector";
import Toolbar from "./Toolbar";
import { useEditor } from "../../context/EditorContext";
import { useEditorStore } from "../../store/useEditorStore";

const EditorShell = () => {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const imageInfo = useEditorStore((state) => state.imageInfo);
  const { actions } = useEditor();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ImageChopper Studio</div>
        <nav className="menu-bar">
          <div className="menu">
            <button className="menu-trigger" type="button">
              Tools
            </button>
            <div className="menu-panel">
              <button
                className={`menu-item ${tool === "select" ? "active" : ""}`}
                onClick={() => setTool("select")}
              >
                Select
              </button>
              <button
                className={`menu-item ${tool === "rect" ? "active" : ""}`}
                onClick={() => setTool("rect")}
              >
                Rectangle
              </button>
              <button
                className={`menu-item ${tool === "polygon" ? "active" : ""}`}
                onClick={() => setTool("polygon")}
              >
                Polygon
              </button>
            </div>
          </div>

          <div className="menu">
            <button className="menu-trigger" type="button">
              Templates
            </button>
            <div className="menu-panel">
              <button
                className="menu-item"
                disabled={!imageInfo}
                onClick={() => actions.applyTemplate("rule-thirds")}
              >
                Rule of Thirds
              </button>
              <button
                className="menu-item"
                disabled={!imageInfo}
                onClick={() => actions.applyTemplate("golden-ratio")}
              >
                Golden Ratio
              </button>
              <button
                className="menu-item"
                disabled={!imageInfo}
                onClick={() => actions.applyTemplate("product-tiles")}
              >
                Product Tiles
              </button>
            </div>
          </div>

          <div className="menu">
            <button className="menu-trigger" type="button">
              Ratios
            </button>
            <div className="menu-panel">
              {["1:1", "4:3", "3:2", "16:9", "9:16"].map((ratio) => (
                <button
                  key={ratio}
                  className="menu-item"
                  disabled={!imageInfo}
                  onClick={() => actions.applyRatio(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="menu">
            <button className="menu-trigger" type="button">
              Adjustments
            </button>
            <div className="menu-panel">
              <button
                className="menu-item"
                onClick={() => document.getElementById("inspector-adjustments")?.scrollIntoView()}
              >
                Open Adjustments
              </button>
              <button className="menu-item" onClick={() => document.getElementById("inspector-zones")?.scrollIntoView()}>
                Open Zones
              </button>
            </div>
          </div>
        </nav>
        <Toolbar />
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="hint">
            Use the menu bar to select tools, templates, ratios, and feature panels.
          </div>
        </aside>

        <main className="canvas-pane">
          <CanvasWorkspace />
        </main>

        <aside className="sidebar">
          <Inspector />
        </aside>
      </div>
    </div>
  );
};

export default EditorShell;
