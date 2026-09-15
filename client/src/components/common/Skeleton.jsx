function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "var(--radius-sm)",
  style = {},
  className = "",
}) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        ...style,
      }}
    />
  );
}

export default Skeleton;

