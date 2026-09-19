import { Check, X, Layers, ShieldCheck, MapPin } from "lucide-react";
import Button from "../common/Button";
import Badge from "../common/Badge";

function PlanApprovalCard({
  plan,
  run,
  onApprove,
  onCancel,
  loading = false,
}) {
  if (!plan) return null;

  const steps = plan.steps || [];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--border-active)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.35)",
        animation: "fadeIn 0.25s ease-out forwards",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <Badge variant="warning" size="xs">
              Advisory Plan Proposal
            </Badge>
            {run?.location && (
              <Badge variant="default" size="xs">
                <MapPin size={10} style={{ marginRight: "2px" }} />
                {run.location && typeof run.location === "object"
                  ? run.location.label || (run.location.latitude != null ? `${run.location.latitude}, ${run.location.longitude}` : String(run.location))
                  : run.location}
              </Badge>
            )}
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: "750", color: "var(--text-primary)" }}>
            Authorize Research Plan
          </h3>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <Layers size={13} />
          <span>{steps.length} Tools Planned</span>
        </div>
      </div>

      {/* Plan Summary */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid var(--border-subtle)",
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: "1.5",
        }}
      >
        {plan.summary || "The agent analyzed the venture goal and proposed the following investigation sequence."}
      </div>

      {/* Steps breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            color: "var(--text-muted)",
          }}
        >
          Proposed Tool Sequence:
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {steps.map((step, idx) => (
            <div
              key={step.toolId || idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                fontSize: "12px",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--primary-subtle)",
                  color: "var(--primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "11px",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                {step.stepIndex || idx + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {step.toolName || step.toolId}
                  </strong>
                  <code style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {step.toolId}
                  </code>
                </div>
                <p style={{ color: "var(--text-secondary)", marginTop: "2px", margin: 0 }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Human Governance Guarantee Alert */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.2)",
          fontSize: "11px",
          color: "var(--status-warning)",
        }}
      >
        <ShieldCheck size={14} style={{ flexShrink: 0 }} />
        <span>
          Human-in-the-loop governance: No external APIs or searches will execute until you approve this plan.
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
        {run?.state === "awaiting_approval" ? (
          <>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={loading}
                icon={<X size={14} />}
              >
                Decline
              </Button>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={onApprove}
              loading={loading}
              icon={<Check size={16} />}
            >
              Approve & Authorize Investigation
            </Button>
          </>
        ) : (
          <Badge variant="viable" size="sm">
            <Check size={12} style={{ marginRight: "4px" }} />
            Plan Authorized
          </Badge>
        )}
      </div>
    </div>
  );
}

export default PlanApprovalCard;

