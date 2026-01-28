import { useEditorStore } from "../../store/useEditorStore";

const Inspector = () => {
  const zones = useEditorStore((state) => state.zones);
  const selectedZoneIds = useEditorStore((state) => state.selectedZoneIds);
  const setZones = useEditorStore((state) => state.setZones);
  const setSelectedZoneIds = useEditorStore((state) => state.setSelectedZoneIds);
  const clearZones = useEditorStore((state) => state.clearZones);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const adjustments = useEditorStore((state) => state.adjustments);
  const setAdjustment = useEditorStore((state) => state.setAdjustment);
  const resetAdjustments = useEditorStore((state) => state.resetAdjustments);

  const deleteZone = (id: string) => {
    setZones(zones.filter((zone) => zone.id !== id));
    setSelectedZoneIds(selectedZoneIds.filter((zoneId) => zoneId !== id));
    pushHistory("Delete zone");
  };

  return (
    <div>
      <div className="section-title" id="inspector-adjustments">
        Adjustments
      </div>
      <div className="hint" style={{ marginBottom: "10px" }}>
        Drag sliders for live preview.
      </div>
      {([
        { key: "brightness", label: "Brightness", min: -50, max: 50 },
        { key: "contrast", label: "Contrast", min: -50, max: 50 },
        { key: "saturation", label: "Saturation", min: -50, max: 50 },
        { key: "blur", label: "Blur", min: 0, max: 12 },
      ] as const).map(({ key, label, min, max }) => (
        <div key={key} style={{ marginBottom: "12px" }}>
          <div className="hint" style={{ display: "flex", justifyContent: "space-between" }}>
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
            style={{ width: "100%" }}
          />
        </div>
      ))}
      <button
        className="btn small ghost"
        onClick={() => {
          resetAdjustments();
          pushHistory("Reset adjustments");
        }}
      >
        Reset Adjustments
      </button>

      <div className="section-title" id="inspector-zones" style={{ marginTop: "16px" }}>
        Zones
      </div>
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
      <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
        <button className="btn small ghost" onClick={() => setSelectedZoneIds([])}>
          Clear Selection
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            clearZones();
            pushHistory("Clear zones");
          }}
        >
          Clear Zones
        </button>
      </div>
    </div>
  );
};

export default Inspector;
