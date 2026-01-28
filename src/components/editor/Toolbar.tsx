import { useRef } from "react";
import { useEditor } from "../../context/EditorContext";
import { useEditorStore } from "../../store/useEditorStore";

const Toolbar = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { actions } = useEditor();
  const zones = useEditorStore((state) => state.zones);

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="topbar-actions">
      <button className="btn ghost" onClick={handleOpen}>
        Open
      </button>
      <button
        className="btn primary"
        onClick={actions.exportZones}
        disabled={zones.length === 0}
      >
        Export Zones
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
  );
};

export default Toolbar;
