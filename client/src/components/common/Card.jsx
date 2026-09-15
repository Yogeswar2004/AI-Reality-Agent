function Card({
  children,
  variant = "default", // 'default' | 'elevated' | 'glass' | 'interactive' | 'glow'
  padding = "md", // 'none' | 'sm' | 'md' | 'lg'
  className = "",
  style = {},
  onClick,
  ...props
}) {
  const paddingStyles = {
    none: { padding: "0" },
    sm: { padding: "var(--space-3)" },
    md: { padding: "var(--space-5)" },
    lg: { padding: "var(--space-6)" },
  };

  const variantStyles = {
    default: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
    },
    elevated: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-md)",
    },
    glass: {
      background: "var(--bg-card)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
    },
    interactive: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      transition: "var(--transition-fast)",
    },
    glow: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-active)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-glow)",
    },
  };

  const isClickable = Boolean(onClick) || variant === "interactive";

  return (
    <div
      onClick={onClick}
      className={`custom-card ${className}`}
      style={{
        position: "relative",
        boxSizing: "border-box",
        ...paddingStyles[padding],
        ...variantStyles[variant],
        ...(isClickable ? { cursor: "pointer" } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;

