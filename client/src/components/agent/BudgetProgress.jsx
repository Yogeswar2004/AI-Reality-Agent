import ProgressBar from "../common/ProgressBar";

function BudgetProgress({ run }) {
  if (!run) return null;

  const stepCount = run.stepCount || 0;
  const maxSteps = run.budget?.maxSteps || 8;
  const externalCallCount = run.externalCallCount || 0;
  const maxExternalCalls = run.budget?.maxExternalCalls || 5;

  const isStepNearLimit = stepCount >= maxSteps - 1;
  const isCallNearLimit = externalCallCount >= maxExternalCalls - 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "14px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
      }}
    >
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
          Investigation Budgets
        </span>
        {run.replanCount > 0 && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--status-warning)",
            }}
          >
            {run.replanCount} Replan{run.replanCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <ProgressBar
          label="Execution Steps"
          value={stepCount}
          max={maxSteps}
          height={6}
          showLabel
          color={isStepNearLimit ? "var(--status-warning)" : "var(--primary-gradient)"}
        />

        <ProgressBar
          label="External Provider Calls"
          value={externalCallCount}
          max={maxExternalCalls}
          height={6}
          showLabel
          color={isCallNearLimit ? "var(--status-quota)" : "linear-gradient(135deg, #3b82f6, #60a5fa)"}
        />
      </div>
    </div>
  );
}

export default BudgetProgress;

