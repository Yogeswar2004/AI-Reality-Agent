import { Play, Sparkles, Pause, RotateCcw } from "lucide-react";
import Button from "../common/Button";

function RunControllerBar({
  run,
  onExecuteStep,
  onRetryStep,
  onResume,
  onSynthesize,
  onCancel,
  loading = false,
}) {
  if (!run) return null;

  const nextDecision = run.currentDecision;
  const isExecuting = run.state === "executing";
  const isResumable =
    run.state === "cancelled" ||
    run.state === "failed" ||
    run.state === "quota_limited";

  if (!isExecuting && !isResumable && run.state !== "awaiting_approval") {
    return null;
  }

  // Next decision actions
  const isExecuteTool = nextDecision?.action === "EXECUTE_TOOL";
  const isReadyToSynthesize = nextDecision?.action === "TRANSITION_SYNTHESIZING";
  const isRetry = isExecuteTool && Boolean(nextDecision?.isRetry);

  if (isResumable) {
    const reasonText =
      typeof run.cancellationReason === "object"
        ? run.cancellationReason?.reason || run.cancellationReason?.summary
        : run.cancellationReason || run.error || "Investigation halted at checkpoint.";

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
              background: "rgba(245, 158, 11, 0.15)",
              color: "var(--status-warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <RotateCcw size={16} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "var(--status-warning)",
                }}
              >
                Investigation Checkpoint Saved
              </span>
            </div>

            <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", margin: "1px 0 0 0" }}>
              {reasonText}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onResume && (
            <Button
              variant="primary"
              size="sm"
              onClick={onResume}
              loading={loading}
              icon={<Play size={14} />}
            >
              Resume Investigation
            </Button>
          )}
        </div>
      </div>
    );
  }

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
            background: isReadyToSynthesize
              ? "rgba(16, 185, 129, 0.15)"
              : isRetry
              ? "rgba(239, 68, 68, 0.15)"
              : "var(--primary-subtle)",
            color: isReadyToSynthesize
              ? "var(--status-viable)"
              : isRetry
              ? "var(--status-danger)"
              : "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isReadyToSynthesize ? (
            <Sparkles size={16} />
          ) : isRetry ? (
            <RotateCcw size={16} />
          ) : (
            <Play size={15} />
          )}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: isRetry ? "var(--status-danger)" : "var(--text-muted)",
              }}
            >
              {isRetry ? "Step Retry Recommended" : "Recommended Action"}
            </span>
          </div>

          <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", margin: "1px 0 0 0" }}>
            {isRetry && (nextDecision?.reasoning || `Retry: ${nextDecision.toolId}`)}
            {!isRetry && isExecuteTool && `Execute: ${nextDecision.toolId}`}
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

        {isRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetryStep || onExecuteStep}
            loading={loading}
            icon={<RotateCcw size={14} />}
          >
            Retry Step
          </Button>
        )}

        {!isRetry && isExecuteTool && (
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
