import { Activity, Database, Sparkles, FileText } from "lucide-react";
import { useAgent } from "../../context/useAgent";
import RunStatus from "./RunStatus";
import BudgetProgress from "./BudgetProgress";
import EvidenceCardList from "./EvidenceCardList";
import AuditStepList from "./AuditStepList";
import FinalVerdictView from "./FinalVerdictView";
import EmptyState from "../common/EmptyState";

function RunInspector() {
  const {
    run,
    steps,
    evidence,
    finalOutput,
    activeTab,
    setActiveTab,
    loadingAction,
    resetWorkspace,
  } = useAgent();

  const tabs = [
    { id: "live", label: "Live Run", icon: <Activity size={13} />, count: null },
    { id: "evidence", label: "Evidence", icon: <Database size={13} />, count: evidence.length || null },
    { id: "activity", label: "Activity", icon: <FileText size={13} />, count: steps.length || null },
    { id: "verdict", label: "Verdict", icon: <Sparkles size={13} />, count: finalOutput ? "★" : null },
  ];

  if (!run && !finalOutput) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <EmptyState
          compact
          icon={<Activity size={24} />}
          title="No active investigation"
          description="Start a new investigation from the conversation feed or select an existing conversation to inspect telemetry."
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      {/* Header Tabs Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "0 16px",
          height: "48px",
          flexShrink: 0,
          background: "rgba(0, 0, 0, 0.15)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "100%",
                padding: "0 12px",
                fontSize: "12px",
                fontWeight: isActive ? "700" : "500",
                color: isActive ? "#ffffff" : "var(--text-muted)",
                borderBottom: `2px solid ${isActive ? "var(--primary-light)" : "transparent"}`,
                transition: "var(--transition-fast)",
                background: "transparent",
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 5px",
                    borderRadius: "var(--radius-full)",
                    background: isActive ? "var(--primary-subtle)" : "rgba(255, 255, 255, 0.06)",
                    color: isActive ? "var(--primary-light)" : "var(--text-muted)",
                    fontWeight: "700",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {activeTab === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <RunStatus state={run?.state || "draft"} />
            <BudgetProgress run={run} />

            {/* Run identity info */}
            {run && (
              <div
                style={{
                  padding: "12px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Target Location: </span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {run.location && typeof run.location === "object"
                      ? run.location.label || (run.location.latitude != null ? `${run.location.latitude}, ${run.location.longitude}` : "Digital / Global")
                      : run.location || "Digital / Global"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Run ID: </span>
                  <code>{run._id}</code>
                </div>
                {run.completedAt && (
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Completed: </span>
                    <span>{new Date(run.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "evidence" && (
          <EvidenceCardList evidence={evidence} loading={loadingAction === "executing_step"} />
        )}

        {activeTab === "activity" && (
          <AuditStepList steps={steps} loading={loadingAction === "executing_step"} />
        )}

        {activeTab === "verdict" && (
          <FinalVerdictView
            output={finalOutput || run?.finalOutput}
            run={run}
            onReset={resetWorkspace}
          />
        )}
      </div>
    </div>
  );
}

export default RunInspector;
