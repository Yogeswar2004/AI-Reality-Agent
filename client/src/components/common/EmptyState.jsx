import Button from "./Button";

function EmptyState({
  icon = null,
  title = "No data available",
  description = "There is nothing to display here yet.",
  actionLabel = null,
  onAction = null,
  actionIcon = null,
  compact = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compact ? "24px 16px" : "48px 24px",
        borderRadius: "var(--radius-md)",
        border: "1px dashed var(--border-subtle)",
        background: "rgba(255, 255, 255, 0.015)",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {icon && (
        <div
          style={{
            width: compact ? "36px" : "48px",
            height: compact ? "36px" : "48px",
            borderRadius: "var(--radius-md)",
            background: "rgba(124, 58, 237, 0.12)",
            color: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "4px",
          }}
        >
          {icon}
        </div>
      )}

      <div>
        <h4
          style={{
            fontSize: compact ? "13px" : "15px",
            fontWeight: "700",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          {title}
        </h4>
        <p
          style={{
            fontSize: compact ? "12px" : "13px",
            color: "var(--text-muted)",
            maxWidth: "360px",
            lineHeight: "1.5",
          }}
        >
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAction}
          icon={actionIcon}
          style={{ marginTop: "6px" }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;

