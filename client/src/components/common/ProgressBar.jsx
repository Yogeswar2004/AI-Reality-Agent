function ProgressBar({
  value = 0,
  max = 10,
  height = 8,
  showLabel = false,
  color = "var(--primary-gradient)",
  bgColor = "rgba(255, 255, 255, 0.08)",
  label = null,
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
      {(showLabel || label) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "11px",
            fontWeight: "600",
            color: "var(--text-secondary)",
          }}
        >
          <span>{label}</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}

      <div
        style={{
          width: "100%",
          height: `${height}px`,
          backgroundColor: bgColor,
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: color,
            borderRadius: "inherit",
            transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;

