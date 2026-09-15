import { Play, Sparkles, Pause } from "lucide-react";
import Button from "../common/Button";

function RunControllerBar({
  run,
  onExecuteStep,
  onSynthesize,
  onCancel,
  loading = false,
}) {
  if (!run) return null;

  const nextDecision = run.currentDecision;
  const isExecuting = run.state === "executing";

  if (!isExecuting && run.state !== "awaiting_approval") {
    return null;
  }

  // Next decision actions
  const isExecuteTool = nextDecision?.action === "EXECUTE_TOOL";
  const isReadyToSynthesize = nextDecision?.action === "TRANSITION_SYNTHESIZING";

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        flexWrap: "wrap",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "240px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-sm)",
            background: isReadyToSynthesize ? "rgba(16, 185, 129, 0.15)" : "var(--primary-subtle)",
            color: isReadyToSynthesize ? "var(--status-viable)" : "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isReadyToSynthesize ? <Sparkles size={16} /> : <Play size={15} />}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "var(--text-muted)",
              }}
            >
              Recommended Action
            </span>
          </div>

          <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", margin: "1px 0 0 0" }}>
            {isExecuteTool && `Execute: ${nextDecision.toolId}`}
            {isReadyToSynthesize && "Investigation Complete — Ready for Synthesis"}
            {!isExecuteTool && !isReadyToSynthesize && (nextDecision?.reasoning || "Awaiting evaluation")}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel("User cancelled investigation")}
            disabled={loading}
            icon={<Pause size={13} />}
          >
            Pause / Stop
          </Button>
        )}

        {isExecuteTool && (
          <Button
            variant="primary"
            size="sm"
            onClick={onExecuteStep}
            loading={loading}
            icon={<Play size={14} />}
          >
            Run Tool Step
          </Button>
        )}

        {isReadyToSynthesize && (
          <Button
            variant="success"
            size="sm"
            onClick={onSynthesize}
            loading={loading}
            icon={<Sparkles size={14} />}
          >
            Synthesize Verdict
          </Button>
        )}
      </div>
    </div>
  );
}

export default RunControllerBar;
