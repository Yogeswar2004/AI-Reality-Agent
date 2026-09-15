import { RefreshCw, ArrowRight } from "lucide-react";
import Badge from "../common/Badge";

function ReplanNotice({
  reason,
  replanCount = 1,
  steps = [],
}) {
  return (
    <div
      style={{
        background: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "var(--radius-xs)",
            background: "rgba(245, 158, 11, 0.2)",
            color: "var(--status-warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RefreshCw size={14} />
        </div>
        <div>
          <Badge variant="warning" size="xs">
            Plan Pivot #{replanCount}
          </Badge>
          <strong style={{ fontSize: "13px", color: "var(--text-primary)", marginLeft: "8px" }}>
            Investigation Plan Dynamically Updated
          </strong>
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
        <strong>Trigger / Rationale:</strong> {reason || "Accumulated evidence necessitated a refined research sequence."}
      </p>

      {steps.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
            paddingTop: "6px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>
            Active Steps:
          </span>
          {steps.map((s, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {s.toolId || s.toolName}
              </span>
              {idx < steps.length - 1 && (
                <ArrowRight size={10} style={{ color: "var(--text-muted)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReplanNotice;

