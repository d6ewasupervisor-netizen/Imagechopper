import { useRef } from "react";
import { useEditor } from "../../context/EditorContext";
import { selectCanRedo, selectCanUndo, useEditorStore } from "../../store/useEditorStore";

const Toolbar = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { actions } = useEditor();
  const zones = useEditorStore((state) => state.zones);
  const isExporting = useEditorStore((state) => state.isExporting);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redoAction);

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="topbar-actions">
      <button className="btn ghost" onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button className="btn ghost" onClick={redo} disabled={!canRedo}>
        Redo
      </button>
      <button className="btn ghost" onClick={handleOpen}>
        Open
      </button>
      <button
        className="btn primary"
        onClick={actions.exportZones}
        disabled={zones.length === 0 || isExporting}
      >
        {isExporting ? "Exporting..." : "Export Zones"}
      </button>
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
    </div>
  );
};

export default Toolbar;
