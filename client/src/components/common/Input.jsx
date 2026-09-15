import { forwardRef } from "react";

const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      multiline = false,
      rows = 4,
      icon = null,
      className = "",
      style = {},
      containerStyle = {},
      disabled = false,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const Component = multiline ? "textarea" : "input";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", ...containerStyle }}>
        {label && (
          <label
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--text-secondary)",
              letterSpacing: "0.2px",
            }}
          >
            {label}
          </label>
        )}

        <div style={{ position: "relative", width: "100%" }}>
          {icon && (
            <div
              style={{
                position: "absolute",
                left: "12px",
                top: multiline ? "14px" : "50%",
                transform: multiline ? "none" : "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              {icon}
            </div>
          )}

          <Component
            ref={ref}
            disabled={disabled}
            rows={multiline ? rows : undefined}
            maxLength={maxLength}
            value={value}
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: `1px solid ${error ? "var(--status-danger)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-md)",
              padding: icon ? "10px 14px 10px 38px" : "10px 14px",
              color: "var(--text-primary)",
              fontSize: "13px",
              lineHeight: "1.5",
              outline: "none",
              boxSizing: "border-box",
              transition: "var(--transition-fast)",
              opacity: disabled ? 0.6 : 1,
              resize: multiline ? "vertical" : "none",
              ...style,
            }}
            className={`custom-input ${className}`}
            {...props}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {error ? (
            <span style={{ fontSize: "11px", color: "var(--status-danger)" }}>{error}</span>
          ) : helperText ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{helperText}</span>
          ) : (
            <span />
          )}

          {maxLength && typeof value === "string" && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;

