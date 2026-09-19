import { useState } from "react";
import { CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import CacheBadge from "./CacheBadge";
import EmptyState from "../common/EmptyState";

function AuditStepList({ steps = [], loading = false, onRetryStep }) {
  const [expandedStepId, setExpandedStepId] = useState(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px 0" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: "60px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
            }}
          />
        ))}
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Terminal size={20} />}
        title="No execution steps recorded"
        description="Tool steps will appear here in chronological order as the investigation progresses."
      />
    );
  }

  const toggleExpand = (id) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--text-muted)",
          }}
        >
          Activity Timeline ({steps.length} Steps)
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {steps.map((step, idx) => {
          const isExpanded = expandedStepId === step._id;
          const isSuccess = step.status === "completed";
          const isFailed = step.status === "failed";
          const toolName = step.metadata?.toolName || step.input?.toolId || step.type;

          return (
            <div
              key={step._id || idx}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                transition: "var(--transition-fast)",
              }}
            >
              {/* Step Header Bar */}
              <div
                onClick={() => toggleExpand(step._id)}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "var(--radius-xs)",
                      background: isSuccess
                        ? "var(--status-viable-bg)"
                        : isFailed
                        ? "var(--status-danger-bg)"
                        : "var(--primary-subtle)",
                      color: isSuccess
                        ? "var(--status-viable)"
                        : isFailed
                        ? "var(--status-danger)"
                        : "var(--primary-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSuccess ? (
                      <CheckCircle2 size={13} />
                    ) : isFailed ? (
                      <AlertCircle size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>
                        #{step.stepNumber}
                      </span>
                      <strong
                        style={{
                          fontSize: "12px",
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {toolName}
                      </strong>
                      {step.attempt && step.attempt > 1 && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "var(--radius-xs)",
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "var(--status-warning)",
                            fontWeight: "700",
                          }}
                        >
                          Attempt {step.attempt} (Retry)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <CacheBadge
                    isCached={step.metadata?.isCached}
                    networkCallMade={step.metadata?.networkCallMade}
                    cachedAt={step.metadata?.cachedAt}
                    size="xs"
                  />

                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {step.createdAt ? new Date(step.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>

                  {isExpanded ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
                </div>
              </div>

              {/* Expandable Technical Details */}
              {isExpanded && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "rgba(0, 0, 0, 0.25)",
                    fontSize: "11px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {step.error && (
                    <div
                      style={{
                        color: "var(--status-danger)",
                        padding: "8px 12px",
                        background: "rgba(239, 68, 68, 0.1)",
                        borderRadius: "var(--radius-xs)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <strong>Error:</strong> {step.error.message || JSON.stringify(step.error)}
                      </div>
                      {isFailed && onRetryStep && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetryStep();
                          }}
                          style={{
                            padding: "4px 10px",
                            background: "var(--status-danger)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "var(--radius-xs)",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Retry Step
                        </button>
                      )}
                    </div>
                  )}

                  {step.metadata?.durationMs && (
                    <div style={{ color: "var(--text-muted)" }}>
                      Execution time: {step.metadata.durationMs}ms
                    </div>
                  )}

                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                      Output Payload:
                    </span>
                    <pre
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-app)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-xs)",
                        color: "var(--text-secondary)",
                        overflowX: "auto",
                        maxHeight: "180px",
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(step.output || step.input || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuditStepList;

