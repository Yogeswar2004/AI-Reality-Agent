import { forwardRef } from "react";
import Spinner from "./Spinner";

const Button = forwardRef(
  (
    {
      children,
      variant = "primary", // 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success'
      size = "md", // 'sm' | 'md' | 'lg'
      loading = false,
      disabled = false,
      icon = null,
      iconPosition = "left",
      type = "button",
      className = "",
      style = {},
      onClick,
      ...props
    },
    ref
  ) => {
    const getBaseStyles = () => {
      const sizes = {
        sm: {
          padding: "6px 12px",
          fontSize: "12px",
          height: "32px",
          gap: "6px",
          borderRadius: "var(--radius-sm)",
        },
        md: {
          padding: "9px 16px",
          fontSize: "13px",
          height: "40px",
          gap: "8px",
          borderRadius: "var(--radius-md)",
        },
        lg: {
          padding: "12px 22px",
          fontSize: "15px",
          height: "48px",
          gap: "10px",
          borderRadius: "var(--radius-md)",
        },
      };

      const variants = {
        primary: {
          background: "var(--primary-gradient)",
          color: "#ffffff",
          border: "1px solid rgba(168, 85, 247, 0.4)",
          boxShadow: "0 4px 14px var(--primary-glow)",
        },
        secondary: {
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-default)",
        },
        outline: {
          background: "transparent",
          color: "var(--text-primary)",
          border: "1px solid var(--border-strong)",
        },
        danger: {
          background: "rgba(239, 68, 68, 0.15)",
          color: "#fca5a5",
          border: "1px solid rgba(239, 68, 68, 0.35)",
        },
        success: {
          background: "linear-gradient(135deg, #10b981, #059669)",
          color: "#ffffff",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
        },
        ghost: {
          background: "transparent",
          color: "var(--text-secondary)",
          border: "1px solid transparent",
        },
      };

      return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "600",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "var(--transition-fast)",
        whiteSpace: "nowrap",
        userSelect: "none",
        ...sizes[size],
        ...variants[variant],
        ...style,
      };
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        style={getBaseStyles()}
        className={`custom-btn ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={size === "sm" ? 14 : 16} />
            {children}
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;

