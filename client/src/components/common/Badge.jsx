function Badge({
  children,
  variant = "default", // 'default' | 'primary' | 'viable' | 'warning' | 'danger' | 'info' | 'quota' | 'cache'
  size = "sm", // 'xs' | 'sm' | 'md'
  dot = false,
  className = "",
  style = {},
}) {
  const sizeStyles = {
    xs: {
      padding: "2px 6px",
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.5px",
    },
    sm: {
      padding: "3px 8px",
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "0.2px",
    },
    md: {
      padding: "5px 12px",
      fontSize: "12px",
      fontWeight: "600",
    },
  };

  const variantStyles = {
    default: {
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-subtle)",
    },
    primary: {
      background: "var(--primary-subtle)",
      color: "var(--primary-light)",
      border: "1px solid rgba(139, 92, 246, 0.35)",
    },
    viable: {
      background: "var(--status-viable-bg)",
      color: "var(--status-viable)",
      border: "1px solid var(--status-viable-border)",
    },
    warning: {
      background: "var(--status-warning-bg)",
      color: "var(--status-warning)",
      border: "1px solid var(--status-warning-border)",
    },
    danger: {
      background: "var(--status-danger-bg)",
      color: "var(--status-danger)",
      border: "1px solid var(--status-danger-border)",
    },
    info: {
      background: "var(--status-info-bg)",
      color: "var(--status-info)",
      border: "1px solid var(--status-info-border)",
    },
    quota: {
      background: "var(--status-quota-bg)",
      color: "var(--status-quota)",
      border: "1px solid var(--status-quota-border)",
    },
    cache: {
      background: "rgba(99, 102, 241, 0.12)",
      color: "#a5b4fc",
      border: "1px solid rgba(99, 102, 241, 0.3)",
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;
  const currentSize = sizeStyles[size] || sizeStyles.sm;

  return (
    <span
      className={`custom-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        borderRadius: "var(--radius-full)",
        lineHeight: "1",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...currentSize,
        ...currentVariant,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "currentColor",
          }}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;

