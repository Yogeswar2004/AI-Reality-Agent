import { useEffect, useState } from "react";
import api from "../api/api";

const PRESET_GOALS = [
  {
    label: "Artisanal Bakery (Denver, CO)",
    goal: "Open an artisanal sourdough bakery and specialty espresso bar",
    location: "Denver, CO",
  },
  {
    label: "AI Code Review SaaS (Tech)",
    goal: "Build an automated pull request security and code documentation generator",
    location: "",
  },
  {
    label: "Boutique Climbing Gym (Boulder, CO)",
    goal: "Open a boutique bouldering gym with community workspace",
    location: "Boulder, CO",
  },
  {
    label: "Cold-Pressed Juice Delivery (Austin, TX)",
    goal: "Subscription cold-pressed organic juice delivery service",
    location: "Austin, TX",
  },
];

function Agent() {
  // --- Form Setup State ---
  const [goal, setGoal] = useState("");
  const [location, setLocation] = useState("");

  // --- Run & Orchestration State ---
  const [run, setRun] = useState(null);
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [nextDecision, setNextDecision] = useState(null);
  const [finalOutput, setFinalOutput] = useState(null);

  // --- UI Control State ---
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [showAuditTimeline, setShowAuditTimeline] = useState(true);
  const [expandedStepId, setExpandedStepId] = useState(null);

  // Determine active stage
  const getStage = () => {
    if (!run) return 1; // Setup
    if (run.finalOutput || finalOutput) return 4; // Final Recommendation
    if (run.state === "draft" || run.state === "planning" || run.state === "awaiting_approval") {
      return 2; // Plan Review
    }
    return 3; // Controlled Investigation (executing, synthesizing, quota_limited, failed, cancelled)
  };

  const stage = getStage();

  // Load audit steps whenever run changes
  const fetchSteps = async (runId) => {
    try {
      const response = await api.get(`/agent/runs/${runId}/steps`);
      if (response.data?.steps) {
        setSteps(response.data.steps);
      }
    } catch (fetchErr) {
      console.warn("Could not fetch steps:", fetchErr?.message);
    }
  };

  // Refresh status from backend
  const refreshStatus = async (runId) => {
    try {
      const response = await api.get(`/agent/runs/${runId}/status`);
      if (response.data) {
        const data = response.data;
        setRun((prev) => ({
          ...prev,
          state: data.state,
          stepCount: data.stepCount,
          externalCallCount: data.externalCallCount,
          budget: data.budget,
          plan: data.plan || prev?.plan,
          completedAt: data.completedAt,
          cancellationReason: data.cancellationReason,
          error: data.error,
        }));
        if (data.plan) setPlan(data.plan);
        if (data.nextDecision) setNextDecision(data.nextDecision);
      }
    } catch (statusErr) {
      console.warn("Could not refresh status:", statusErr?.message);
    }
  };

  // --- 1. SETUP: Initialize Run & Advisory Plan ---
  const handleStartRun = async (event) => {
    if (event) event.preventDefault();
    if (!goal.trim()) {
      setError("Please describe the business or tech venture to investigate.");
      return;
    }

    setError("");
    setLoadingAction("initializing");

    try {
      // 1. Create run
      const createRes = await api.post("/agent/runs", {
        goal: goal.trim(),
        location: location.trim() || null,
      });
      const newRun = createRes.data.run;
      setRun(newRun);

      // 2. Generate plan immediately (DRAFT -> PLANNING -> AWAITING_APPROVAL)
      setLoadingAction("planning");
      const planRes = await api.post(`/agent/runs/${newRun._id}/plan`);
      const updatedPlan = planRes.data.plan;
      const updatedRun = planRes.data.run;

      setPlan(updatedPlan);
      setRun(updatedRun);
      await fetchSteps(newRun._id);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to initialize agent run or generate research plan."
      );
    } finally {
      setLoadingAction("");
    }
  };

  // --- 2. PLAN REVIEW: Approve Plan ---
  const handleApprovePlan = async () => {
    if (!run) return;
    setError("");
    setLoadingAction("approving");

    try {
      const response = await api.post(`/agent/runs/${run._id}/approve-plan`);
      const updatedRun = response.data.run;
      const decision = response.data.nextDecision;

      setRun(updatedRun);
      if (decision) setNextDecision(decision);

      await fetchSteps(run._id);
      await refreshStatus(run._id);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to approve research plan."
      );
    } finally {
      setLoadingAction("");
    }
  };

  // --- Cancel Run ---
  const handleCancelRun = async (reason = "Cancelled by user") => {
    if (!run) return;
    setError("");
    setLoadingAction("cancelling");

    try {
      const response = await api.post(`/agent/runs/${run._id}/cancel`, { reason });
      setRun(response.data.run);
      await refreshStatus(run._id);
      await fetchSteps(run._id);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to cancel agent run."
      );
    } finally {
      setLoadingAction("");
    }
  };

  // --- 3. INVESTIGATION: Run Step ---
  const handleExecuteNextStep = async () => {
    if (!run || !nextDecision || nextDecision.action !== "EXECUTE_TOOL") return;
    setError("");
    setLoadingAction("executing_step");

    try {
      const response = await api.post(`/agent/runs/${run._id}/execute-tool`, {
        toolId: nextDecision.toolId,
        input: nextDecision.input || {},
      });

      if (response.data.run) {
        setRun((prev) => ({ ...prev, ...response.data.run }));
      }
      if (response.data.nextDecision) {
        setNextDecision(response.data.nextDecision);
      }

      await fetchSteps(run._id);
      await refreshStatus(run._id);
    } catch (err) {
      setError(
        err.response?.data?.message || "Tool step execution encountered an error."
      );
      await refreshStatus(run._id);
      await fetchSteps(run._id);
    } finally {
      setLoadingAction("");
    }
  };

  // --- 4. SYNTHESIS: Synthesize Recommendation ---
  const handleSynthesize = async () => {
    if (!run) return;
    setError("");
    setLoadingAction("synthesizing");

    try {
      const response = await api.post(`/agent/runs/${run._id}/synthesize`);
      setFinalOutput(response.data.finalOutput);
      if (response.data.run) {
        setRun(response.data.run);
      }
      await fetchSteps(run._id);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to synthesize final recommendation."
      );
    } finally {
      setLoadingAction("");
    }
  };

  // --- Reset to Start New Run ---
  const handleStartNewRun = () => {
    setRun(null);
    setPlan(null);
    setSteps([]);
    setNextDecision(null);
    setFinalOutput(null);
    setError("");
    setGoal("");
    setLocation("");
  };

  // Helper: Status badge color scheme
  const getStateBadgeStyle = (state) => {
    switch (state) {
      case "completed":
        return { bg: "rgba(34, 197, 94, 0.15)", color: "#86EFAC", border: "rgba(34, 197, 94, 0.3)" };
      case "executing":
      case "synthesizing":
        return { bg: "rgba(124, 58, 237, 0.15)", color: "#C4B5FD", border: "rgba(139, 92, 246, 0.3)" };
      case "awaiting_approval":
        return { bg: "rgba(245, 158, 11, 0.15)", color: "#FCD34D", border: "rgba(245, 158, 11, 0.3)" };
      case "failed":
        return { bg: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", border: "rgba(239, 68, 68, 0.3)" };
      case "quota_limited":
        return { bg: "rgba(249, 115, 22, 0.15)", color: "#FDBA74", border: "rgba(249, 115, 22, 0.3)" };
      case "cancelled":
        return { bg: "rgba(113, 113, 122, 0.15)", color: "#D4D4D8", border: "rgba(113, 113, 122, 0.3)" };
      default:
        return { bg: "rgba(161, 161, 170, 0.12)", color: "#D4D4D8", border: "rgba(161, 161, 170, 0.25)" };
    }
  };

  // Helper: Verdict badge color scheme
  const getVerdictStyle = (verdict) => {
    switch (verdict) {
      case "STRONG_VIABILITY":
        return { bg: "rgba(34, 197, 94, 0.2)", color: "#86EFAC", border: "rgba(34, 197, 94, 0.4)", text: "Strong Viability" };
      case "MODERATE_VIABILITY":
        return { bg: "rgba(124, 58, 237, 0.2)", color: "#C4B5FD", border: "rgba(139, 92, 246, 0.4)", text: "Moderate Viability" };
      case "HIGH_RISK":
        return { bg: "rgba(239, 68, 68, 0.2)", color: "#FCA5A5", border: "rgba(239, 68, 68, 0.4)", text: "High Risk" };
      default:
        return { bg: "rgba(245, 158, 11, 0.2)", color: "#FCD34D", border: "rgba(245, 158, 11, 0.4)", text: "Inconclusive" };
    }
  };

  return (
    <div style={styles.page}>
      <style>{responsiveCSS}</style>
      <div style={styles.container}>

        {/* ===================================================
            STUDIO HEADER & STAGE STEPPER
        =================================================== */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              <span style={styles.eyebrowIcon}>✦</span> AI REALITY AGENT STUDIO
            </div>
            <h1 style={styles.title}>Autonomous Investigation Studio</h1>
            <p style={styles.subtitle}>
              Controlled, evidence-driven venture discovery. The agent develops an advisory research plan, executes tools with human approval, and synthesizes grounded viability verdicts.
            </p>
          </div>

          {run && (
            <button
              type="button"
              style={styles.newRunButton}
              onClick={handleStartNewRun}
            >
              + Start New Run
            </button>
          )}
        </header>

        {/* STAGES BREADCRUMB INDICATOR */}
        <div style={styles.stepperContainer}>
          {[
            { num: 1, label: "1. Setup" },
            { num: 2, label: "2. Plan Review" },
            { num: 3, label: "3. Investigation" },
            { num: 4, label: "4. Recommendation" },
          ].map((s) => {
            const isActive = stage === s.num;
            const isDone = stage > s.num;
            return (
              <div
                key={s.num}
                style={{
                  ...styles.stepItem,
                  ...(isActive ? styles.stepItemActive : {}),
                  ...(isDone ? styles.stepItemDone : {}),
                }}
              >
                <span style={styles.stepCircle}>{isDone ? "✓" : s.num}</span>
                <span style={styles.stepLabel}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div style={styles.errorAlert}>
            <div style={styles.errorIcon}>⚠</div>
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", marginBottom: "4px" }}>Notice</strong>
              <span>{error}</span>
            </div>
            <button
              type="button"
              style={styles.dismissErrorBtn}
              onClick={() => setError("")}
            >
              ✕
            </button>
          </div>
        )}

        {/* ===================================================
            STAGE 1: SETUP (GOAL & LOCATION INPUT)
        =================================================== */}
        {stage === 1 && (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <span style={styles.cardEyebrow}>STAGE 1 — DEFINE GOAL</span>
                <h2 style={styles.cardTitle}>What venture would you like to investigate?</h2>
              </div>
            </div>

            {/* QUICK PRESET CHIPS */}
            <div style={styles.presetsWrapper}>
              <span style={styles.presetLabel}>Quick Presets:</span>
              <div style={styles.presetChips}>
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    style={styles.presetChip}
                    onClick={() => {
                      setGoal(preset.goal);
                      setLocation(preset.location);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleStartRun} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label htmlFor="agent-goal" style={styles.fieldLabel}>
                  Venture Goal or Problem Statement <span style={{ color: "#F43F5E" }}>*</span>
                </label>
                <textarea
                  id="agent-goal"
                  rows={4}
                  style={styles.textarea}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Example: Evaluate whether opening a high-end specialty coffee roastery with cold brew on tap is viable in Portland, OR."
                  disabled={Boolean(loadingAction)}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="agent-location" style={styles.fieldLabel}>
                  Target Geographic Location <span style={{ color: "#71717A" }}>(Required for local business tools)</span>
                </label>
                <input
                  id="agent-location"
                  type="text"
                  style={styles.input}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Example: Portland, OR or Austin, TX (Leave blank for pure software/tech products)"
                  disabled={Boolean(loadingAction)}
                />
              </div>

              <div style={styles.formActions}>
                <button
                  type="submit"
                  disabled={Boolean(loadingAction) || !goal.trim()}
                  style={{
                    ...styles.primaryButton,
                    ...(Boolean(loadingAction) || !goal.trim() ? styles.buttonDisabled : {}),
                  }}
                >
                  {loadingAction === "initializing" || loadingAction === "planning" ? (
                    <>
                      <span style={styles.spinner} />
                      Generating Advisory Plan...
                    </>
                  ) : (
                    <>
                      <span>✦</span> Initialize Investigation Plan
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ===================================================
            STAGE 2: PLAN REVIEW (HUMAN-IN-THE-LOOP APPROVAL)
        =================================================== */}
        {stage === 2 && plan && (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <span style={styles.cardEyebrow}>STAGE 2 — HUMAN-IN-THE-LOOP GOVERNANCE</span>
                <h2 style={styles.cardTitle}>Review Advisory Research Plan</h2>
                <p style={styles.cardSubtitle}>
                  The agent analyzed your goal and proposed the following research sequence. No external tools or searches will run without your explicit approval.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    ...styles.badge,
                    ...getStateBadgeStyle(run?.state || "awaiting_approval"),
                  }}
                >
                  {(run?.state || "awaiting_approval").toUpperCase().replace("_", " ")}
                </span>
              </div>
            </div>

            {/* PLAN SUMMARY BOX */}
            <div style={styles.planSummaryBox}>
              <div style={styles.planSummaryRow}>
                <div>
                  <span style={styles.metricLabel}>Plan Category</span>
                  <p style={styles.metricValue}>
                    {plan.category === "local" ? "Local Market Chain" : "Technology Feasibility"}
                  </p>
                </div>
                <div>
                  <span style={styles.metricLabel}>Target Steps</span>
                  <p style={styles.metricValue}>{plan.steps?.length || 0} Tools Planned</p>
                </div>
                <div>
                  <span style={styles.metricLabel}>Investigation Scope</span>
                  <p style={styles.metricValue}>{run?.location || "Global / Digital"}</p>
                </div>
              </div>
              <p style={styles.planDescription}>{plan.summary}</p>
            </div>

            {/* PLANNED STEPS LIST */}
            <div style={styles.plannedStepsSection}>
              <h3 style={styles.sectionHeader}>Proposed Tool Sequence</h3>
              <div style={styles.plannedStepsGrid}>
                {plan.steps?.map((step, idx) => (
                  <div key={step.toolId || idx} style={styles.stepCard}>
                    <div style={styles.stepCardTop}>
                      <span style={styles.stepNumberBadge}>Step {step.stepIndex || idx + 1}</span>
                      <span style={styles.toolIdPill}>{step.toolId}</span>
                    </div>
                    <h4 style={styles.stepToolName}>{step.toolName || step.toolId}</h4>
                    <p style={styles.stepDescription}>{step.description}</p>
                    {step.params && (
                      <div style={styles.stepParamsBox}>
                        <span style={styles.paramsLabel}>Parameters:</span>
                        <pre style={styles.paramsPre}>
                          {JSON.stringify(step.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* APPROVAL / CANCEL ACTIONS */}
            <div style={styles.approvalActionsBar}>
              <button
                type="button"
                style={styles.cancelButton}
                disabled={Boolean(loadingAction)}
                onClick={() => handleCancelRun("User rejected proposed plan")}
              >
                ✕ Cancel Run
              </button>
              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  ...(Boolean(loadingAction) ? styles.buttonDisabled : {}),
                }}
                disabled={Boolean(loadingAction)}
                onClick={handleApprovePlan}
              >
                {loadingAction === "approving" ? (
                  <>
                    <span style={styles.spinner} /> Authorizing Execution...
                  </>
                ) : (
                  <>
                    <span>✓</span> Approve & Begin Investigation
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ===================================================
            STAGE 3: CONTROLLED INVESTIGATION FEED
        =================================================== */}
        {stage === 3 && run && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* REAL-TIME RUN CONTROLLER HEADER */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.cardEyebrow}>STAGE 3 — CONTROLLED EXECUTION</span>
                  <h2 style={styles.cardTitle}>{run.goal}</h2>
                  <p style={styles.cardSubtitle}>
                    Location: <strong>{run.location || "Digital / Global"}</strong> • Run ID: {run._id}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ ...styles.badge, ...getStateBadgeStyle(run.state) }}>
                    {run.state?.toUpperCase().replace("_", " ")}
                  </span>
                  {run.state === "executing" && (
                    <button
                      type="button"
                      style={styles.smallDangerBtn}
                      disabled={Boolean(loadingAction)}
                      onClick={() => handleCancelRun("Cancelled by user")}
                    >
                      Cancel Run
                    </button>
                  )}
                </div>
              </div>

              {/* BUDGET COUNTERS */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.metricLabel}>Total Steps</span>
                  <span style={styles.statValue}>
                    {run.stepCount || 0}
                    <span style={styles.statSubValue}> / {run.budget?.maxSteps || 8}</span>
                  </span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.metricLabel}>External API Calls</span>
                  <span style={styles.statValue}>
                    {run.externalCallCount || 0}
                    <span style={styles.statSubValue}> / {run.budget?.maxExternalCalls || 5}</span>
                  </span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.metricLabel}>Completed Steps</span>
                  <span style={styles.statValue}>
                    {steps.filter((s) => s.status === "completed").length}
                  </span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.metricLabel}>Failed Steps</span>
                  <span style={styles.statValue}>
                    {steps.filter((s) => s.status === "failed").length}
                  </span>
                </div>
              </div>
            </section>

            {/* ADVISORY NEXT DECISION CARD */}
            {run.state === "executing" && nextDecision && (
              <section style={styles.actionPromptCard}>
                <div style={styles.actionPromptHeader}>
                  <div style={styles.actionIconContainer}>
                    {nextDecision.action === "EXECUTE_TOOL" && "⚡"}
                    {nextDecision.action === "TRANSITION_SYNTHESIZING" && "✦"}
                    {nextDecision.action === "FAIL" && "⚠"}
                    {nextDecision.action === "QUOTA_EXHAUSTED" && "⊘"}
                  </div>
                  <div>
                    <span style={styles.actionEyebrow}>PLANNER ADVISORY RECOMMENDATION</span>
                    <h3 style={styles.actionTitle}>
                      {nextDecision.action === "EXECUTE_TOOL" && `Execute Tool: ${nextDecision.toolId}`}
                      {nextDecision.action === "TRANSITION_SYNTHESIZING" && "All Tools Completed — Ready for Synthesis"}
                      {nextDecision.action === "FAIL" && "Tool Execution Failure Halted Progression"}
                      {nextDecision.action === "QUOTA_EXHAUSTED" && "Budget Limit Reached"}
                    </h3>
                  </div>
                </div>

                {nextDecision.reasoning && (
                  <p style={styles.actionReasoning}>{nextDecision.reasoning}</p>
                )}
                {nextDecision.reason && (
                  <p style={{ ...styles.actionReasoning, color: "#FCA5A5" }}>{nextDecision.reason}</p>
                )}

                {/* Evidence parameters preview if executing a tool */}
                {nextDecision.action === "EXECUTE_TOOL" && nextDecision.input && (
                  <div style={styles.decisionParamsBox}>
                    <span style={styles.paramsLabel}>Tool Input Parameters (Derived from prior step evidence):</span>
                    <pre style={styles.paramsPre}>{JSON.stringify(nextDecision.input, null, 2)}</pre>
                  </div>
                )}

                {/* Primary action buttons */}
                <div style={styles.actionButtonsRow}>
                  {nextDecision.action === "EXECUTE_TOOL" && (
                    <button
                      type="button"
                      style={{
                        ...styles.primaryButton,
                        ...(Boolean(loadingAction) ? styles.buttonDisabled : {}),
                      }}
                      disabled={Boolean(loadingAction)}
                      onClick={handleExecuteNextStep}
                    >
                      {loadingAction === "executing_step" ? (
                        <>
                          <span style={styles.spinner} /> Running Tool...
                        </>
                      ) : (
                        <>
                          <span>▶</span> Run Tool Step ({nextDecision.toolId})
                        </>
                      )}
                    </button>
                  )}

                  {nextDecision.action === "TRANSITION_SYNTHESIZING" && (
                    <button
                      type="button"
                      style={{
                        ...styles.primaryButton,
                        background: "linear-gradient(135deg, #10B981, #059669)",
                        ...(Boolean(loadingAction) ? styles.buttonDisabled : {}),
                      }}
                      disabled={Boolean(loadingAction)}
                      onClick={handleSynthesize}
                    >
                      {loadingAction === "synthesizing" ? (
                        <>
                          <span style={styles.spinner} /> Synthesizing Recommendation...
                        </>
                      ) : (
                        <>
                          <span>✦</span> Synthesize Final Recommendation
                        </>
                      )}
                    </button>
                  )}

                  {nextDecision.action === "FAIL" && (
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <button
                        type="button"
                        style={styles.cancelButton}
                        onClick={() => handleCancelRun("Halted on tool failure")}
                      >
                        Abort Run
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={handleStartNewRun}
                      >
                        Start Fresh Run
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TERMINAL STATE BANNERS (QUOTA LIMITED / CANCELLED / FAILED) */}
            {run.state === "quota_limited" && (
              <div style={styles.terminalAlert}>
                <span style={styles.terminalAlertIcon}>⊘</span>
                <div>
                  <h4 style={styles.terminalAlertTitle}>Quota Budget Exhausted</h4>
                  <p style={styles.terminalAlertText}>
                    This run reached its configured step or external-call limit. The system halted further tool execution to prevent excessive provider usage.
                  </p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={handleStartNewRun}>
                  Start New Run
                </button>
              </div>
            )}

            {run.state === "cancelled" && (
              <div style={styles.terminalAlert}>
                <span style={styles.terminalAlertIcon}>✕</span>
                <div>
                  <h4 style={styles.terminalAlertTitle}>Run Cancelled</h4>
                  <p style={styles.terminalAlertText}>
                    Reason: {run.cancellationReason || "Cancelled by user"}.
                  </p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={handleStartNewRun}>
                  Start New Run
                </button>
              </div>
            )}

            {/* AUDIT STEP TIMELINE */}
            <section style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <h3 style={styles.sectionHeader}>Investigation Audit Trail ({steps.length} Steps)</h3>
                <button
                  type="button"
                  style={styles.textToggleButton}
                  onClick={() => setShowAuditTimeline(!showAuditTimeline)}
                >
                  {showAuditTimeline ? "Hide Log ▲" : "Show Log ▼"}
                </button>
              </div>

              {showAuditTimeline && (
                <div style={styles.stepsTimeline}>
                  {steps.length === 0 ? (
                    <p style={{ color: "#71717A", fontSize: "13px" }}>No steps recorded yet.</p>
                  ) : (
                    steps.map((s, idx) => (
                      <div key={s._id || idx} style={styles.timelineItem}>
                        <div style={styles.timelineLeft}>
                          <span
                            style={{
                              ...styles.timelineDot,
                              background:
                                s.status === "completed"
                                  ? "#22C55E"
                                  : s.status === "failed"
                                  ? "#EF4444"
                                  : "#8B5CF6",
                            }}
                          />
                        </div>
                        <div style={styles.timelineContent}>
                          <div style={styles.timelineHeader}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={styles.stepBadge}>Step {s.stepNumber}</span>
                              <strong style={styles.stepTitle}>
                                {s.metadata?.toolName || s.input?.toolId || s.type}
                              </strong>
                            </div>
                            <span
                              style={{
                                ...styles.statusPill,
                                color: s.status === "completed" ? "#86EFAC" : s.status === "failed" ? "#FCA5A5" : "#C4B5FD",
                              }}
                            >
                              {s.status}
                            </span>
                          </div>

                          {s.error && (
                            <p style={styles.stepErrorText}>Error: {s.error.message || s.error}</p>
                          )}

                          <button
                            type="button"
                            style={styles.detailsToggle}
                            onClick={() =>
                              setExpandedStepId(expandedStepId === s._id ? null : s._id)
                            }
                          >
                            {expandedStepId === s._id ? "Collapse Details ▴" : "View Output Data ▾"}
                          </button>

                          {expandedStepId === s._id && (
                            <div style={styles.expandedOutputBox}>
                              <span style={styles.paramsLabel}>Step Output Payload:</span>
                              <pre style={styles.paramsPre}>
                                {JSON.stringify(s.output || s.input || {}, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================
            STAGE 4: FINAL RECOMMENDATION DISPLAY
        =================================================== */}
        {stage === 4 && (finalOutput || run?.finalOutput) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {(() => {
              const out = finalOutput || run.finalOutput;
              const verdictStyle = getVerdictStyle(out.verdict);

              return (
                <>
                  {/* HERO VERDICT CARD */}
                  <section style={styles.verdictHeroCard}>
                    <div style={styles.verdictTopRow}>
                      <div>
                        <span style={styles.cardEyebrow}>STAGE 4 — FINAL GROUNDED RECOMMENDATION</span>
                        <h2 style={styles.verdictGoalText}>{run?.goal}</h2>
                      </div>
                      <div
                        style={{
                          ...styles.verdictBadge,
                          background: verdictStyle.bg,
                          color: verdictStyle.color,
                          borderColor: verdictStyle.border,
                        }}
                      >
                        {verdictStyle.text}
                      </div>
                    </div>

                    <p style={styles.verdictSummary}>{out.summary}</p>

                    {/* CONFIDENCE & FEASIBILITY GAUGES */}
                    <div style={styles.scoreGaugesGrid}>
                      <div style={styles.gaugeBox}>
                        <span style={styles.metricLabel}>Overall Confidence Score</span>
                        <div style={styles.scoreRow}>
                          <span style={styles.scoreBig}>{out.confidenceScore ?? "N/A"}</span>
                          <span style={styles.scoreDenominator}> / 10.0</span>
                        </div>
                        <div style={styles.progressBarBg}>
                          <div
                            style={{
                              ...styles.progressBarFill,
                              width: `${Math.min(100, ((out.confidenceScore || 0) / 10) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div style={styles.gaugeBox}>
                        <span style={styles.metricLabel}>Technical Feasibility</span>
                        <p style={{ ...styles.metricValue, color: "#C4B5FD", fontSize: "20px", marginTop: "8px" }}>
                          {out.feasibility || "Unknown"}
                        </p>
                      </div>

                      <div style={styles.gaugeBox}>
                        <span style={styles.metricLabel}>Market Fit Score</span>
                        <div style={styles.scoreRow}>
                          <span style={styles.scoreBig}>{out.marketFit?.score ?? "N/A"}</span>
                          <span style={styles.scoreDenominator}> / 10.0</span>
                        </div>
                        <p style={{ color: "#A1A1AA", fontSize: "11px", marginTop: "4px" }}>
                          {out.marketFit?.analysis || ""}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* LOCAL COMPETITOR & SENTIMENT EVIDENCE (IF PRESENT) */}
                  {out.localEvidence && (
                    <section style={styles.card}>
                      <span style={styles.cardEyebrow}>MARKET DISCOVERY EVIDENCE</span>
                      <h3 style={styles.sectionHeader}>Local Competitor & Sentiment Findings</h3>

                      <div style={styles.localEvidenceGrid}>
                        <div style={styles.statCard}>
                          <span style={styles.metricLabel}>Local Competitors</span>
                          <span style={styles.statValue}>
                            {out.localEvidence.competitorCount ?? 0}
                          </span>
                          <span style={styles.subText}>
                            Density: {out.localEvidence.competitorDensity || "N/A"}
                          </span>
                        </div>

                        <div style={styles.statCard}>
                          <span style={styles.metricLabel}>Average Rating</span>
                          <span style={styles.statValue}>
                            {out.localEvidence.averageCompetitorRating
                              ? `${out.localEvidence.averageCompetitorRating} ★`
                              : "N/A"}
                          </span>
                          <span style={styles.subText}>
                            Total Reviews: {out.localEvidence.totalCompetitorReviews ?? 0}
                          </span>
                        </div>

                        <div style={styles.statCard}>
                          <span style={styles.metricLabel}>Analyzed Competitor</span>
                          <span style={{ ...styles.statValue, fontSize: "16px", wordBreak: "break-word" }}>
                            {out.localEvidence.reviewedBusinessName || "None"}
                          </span>
                          <span style={styles.subText}>
                            Sampled: {out.localEvidence.reviewsSampled ?? 0} reviews
                          </span>
                        </div>
                      </div>

                      {/* SENTIMENT BREAKDOWN */}
                      {out.localEvidence.sentimentSummary && (
                        <div style={styles.sentimentBox}>
                          <h4 style={styles.sentimentTitle}>Customer Sentiment Overview</h4>
                          <p style={styles.sentimentSummaryText}>{out.localEvidence.sentimentSummary}</p>

                          <div style={styles.sentimentPillsGrid}>
                            {out.localEvidence.sentimentStrengths?.length > 0 && (
                              <div style={styles.sentimentCategory}>
                                <span style={{ ...styles.paramsLabel, color: "#86EFAC" }}>Competitor Strengths:</span>
                                <div style={styles.tagWrap}>
                                  {out.localEvidence.sentimentStrengths.map((str, i) => (
                                    <span key={i} style={styles.greenTag}>{str}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {out.localEvidence.sentimentWeaknesses?.length > 0 && (
                              <div style={styles.sentimentCategory}>
                                <span style={{ ...styles.paramsLabel, color: "#FCA5A5" }}>Competitor Weaknesses:</span>
                                <div style={styles.tagWrap}>
                                  {out.localEvidence.sentimentWeaknesses.map((weak, i) => (
                                    <span key={i} style={styles.redTag}>{weak}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {out.localEvidence.sentimentOpportunities?.length > 0 && (
                              <div style={styles.sentimentCategory}>
                                <span style={{ ...styles.paramsLabel, color: "#C4B5FD" }}>Unmet Market Gaps / Opportunities:</span>
                                <div style={styles.tagWrap}>
                                  {out.localEvidence.sentimentOpportunities.map((opp, i) => (
                                    <span key={i} style={styles.violetTag}>{opp}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* TECH STACK & STRATEGIC RECOMMENDATIONS */}
                  <div style={styles.twoColumnGrid}>
                    {/* RECOMMENDED TECH STACK */}
                    {out.suggestedStack?.length > 0 && (
                      <section style={styles.card}>
                        <span style={styles.cardEyebrow}>ARCHITECTURE</span>
                        <h3 style={styles.sectionHeader}>Suggested Tech Stack</h3>
                        <div style={styles.tagWrap}>
                          {out.suggestedStack.map((tech, idx) => (
                            <span key={idx} style={styles.techTag}>{tech}</span>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* KEY RISKS */}
                    {out.keyRisks?.length > 0 && (
                      <section style={styles.card}>
                        <span style={styles.cardEyebrow}>RISK EVALUATION</span>
                        <h3 style={styles.sectionHeader}>Key Identified Risks</h3>
                        <ul style={styles.riskList}>
                          {out.keyRisks.map((risk, idx) => (
                            <li key={idx} style={styles.riskItem}>
                              <span style={styles.riskBullet}>⚠</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>

                  {/* STRATEGIC RECOMMENDATIONS LIST */}
                  {out.recommendations?.length > 0 && (
                    <section style={styles.card}>
                      <span style={styles.cardEyebrow}>STRATEGIC NEXT STEPS</span>
                      <h3 style={styles.sectionHeader}>Prioritized Action Plan</h3>
                      <ol style={styles.recList}>
                        {out.recommendations.map((rec, idx) => (
                          <li key={idx} style={styles.recItem}>
                            <span style={styles.recNumber}>{idx + 1}</span>
                            <span style={styles.recText}>{rec}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {/* EVIDENCE AUDIT & INTEGRITY METADATA */}
                  <section style={styles.card}>
                    <span style={styles.cardEyebrow}>AUDIT METADATA</span>
                    <h3 style={styles.sectionHeader}>Evidence Verification Status</h3>
                    <div style={styles.auditMetaGrid}>
                      <div>
                        <span style={styles.metricLabel}>Total Steps Executed:</span>
                        <p style={styles.metricValue}>{out.evidence?.totalSteps ?? 0}</p>
                      </div>
                      <div>
                        <span style={styles.metricLabel}>Partial Synthesis:</span>
                        <p style={{ ...styles.metricValue, color: out.evidence?.partial ? "#FCD34D" : "#86EFAC" }}>
                          {out.evidence?.partial ? "Yes (Some dimensions unverified)" : "No (Complete plan executed)"}
                        </p>
                      </div>
                      <div>
                        <span style={styles.metricLabel}>Unverified Dimensions:</span>
                        <div style={styles.tagWrap}>
                          {out.evidence?.unverifiedDimensions?.map((dim, i) => (
                            <span key={i} style={styles.neutralTag}>{dim}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* BOTTOM ACTION BAR */}
                  <div style={styles.bottomBar}>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={handleStartNewRun}
                    >
                      + Start Another Investigation
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

/* =====================================================
   RESPONSIVE CSS RULES
===================================================== */
const responsiveCSS = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .agent-stepper {
      flex-direction: column !important;
      gap: 10px !important;
    }
  }
`;

/* =====================================================
   SCOPED STYLES
===================================================== */
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -20%, rgba(124, 58, 237, 0.14), transparent 42%), #07070A",
    color: "#FFFFFF",
    padding: "40px 20px 90px",
    fontFamily: "Inter, system-ui, Arial, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "1080px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "28px",
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "2px",
    color: "#A78BFA",
    marginBottom: "8px",
    textTransform: "uppercase",
  },
  eyebrowIcon: {
    color: "#C084FC",
    fontSize: "14px",
  },
  title: {
    fontSize: "clamp(26px, 4vw, 36px)",
    fontWeight: "800",
    letterSpacing: "-1px",
    lineHeight: "1.15",
    color: "#FFFFFF",
    margin: "0 0 10px 0",
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: "14px",
    lineHeight: "1.6",
    maxWidth: "760px",
    margin: 0,
  },
  newRunButton: {
    padding: "10px 18px",
    borderRadius: "8px",
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "0.2s ease",
  },
  stepperContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    marginBottom: "28px",
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "10px",
    background: "rgba(24, 24, 27, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    color: "#71717A",
    fontSize: "13px",
    fontWeight: "600",
  },
  stepItemActive: {
    background: "rgba(124, 58, 237, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.4)",
    color: "#C4B5FD",
  },
  stepItemDone: {
    background: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    color: "#86EFAC",
  },
  stepCircle: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.08)",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: "800",
  },
  stepLabel: {
    whiteSpace: "nowrap",
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 18px",
    borderRadius: "10px",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#FCA5A5",
    marginBottom: "24px",
    fontSize: "13px",
  },
  errorIcon: {
    fontSize: "18px",
  },
  dismissErrorBtn: {
    background: "transparent",
    border: "none",
    color: "#FCA5A5",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px",
  },
  card: {
    background: "rgba(18, 18, 23, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "26px",
    backdropFilter: "blur(14px)",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    gap: "16px",
    flexWrap: "wrap",
  },
  cardEyebrow: {
    display: "block",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#A78BFA",
    marginBottom: "6px",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: "0 0 6px 0",
    letterSpacing: "-0.5px",
  },
  cardSubtitle: {
    color: "#A1A1AA",
    fontSize: "13px",
    margin: 0,
    lineHeight: "1.5",
  },
  presetsWrapper: {
    marginBottom: "20px",
  },
  presetLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#71717A",
    display: "block",
    marginBottom: "8px",
  },
  presetChips: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  presetChip: {
    padding: "6px 12px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#D4D4D8",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "0.15s ease",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#E4E4E7",
  },
  textarea: {
    width: "100%",
    padding: "14px 16px",
    background: "rgba(9, 9, 11, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "10px",
    color: "#FFFFFF",
    fontSize: "14px",
    lineHeight: "1.6",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(9, 9, 11, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "10px",
    color: "#FFFFFF",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "10px",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 24px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #7C3AED, #9333EA)",
    border: "none",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "750",
    cursor: "pointer",
    boxShadow: "0 8px 25px rgba(124, 58, 237, 0.25)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "9px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#E4E4E7",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  cancelButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "9px",
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    color: "#FCA5A5",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  smallDangerBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#FCA5A5",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 12px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    border: "1px solid",
  },
  planSummaryBox: {
    background: "rgba(9, 9, 11, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "12px",
    padding: "18px 22px",
    marginBottom: "24px",
  },
  planSummaryRow: {
    display: "flex",
    gap: "36px",
    flexWrap: "wrap",
    marginBottom: "12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    paddingBottom: "12px",
  },
  planDescription: {
    color: "#D4D4D8",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: 0,
  },
  plannedStepsSection: {
    marginBottom: "24px",
  },
  plannedStepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
  },
  stepCard: {
    background: "rgba(24, 24, 27, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "12px",
    padding: "16px",
  },
  stepCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  stepNumberBadge: {
    fontSize: "11px",
    fontWeight: "800",
    color: "#C4B5FD",
    background: "rgba(124, 58, 237, 0.2)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  toolIdPill: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#71717A",
  },
  stepToolName: {
    fontSize: "15px",
    fontWeight: "750",
    color: "#FFFFFF",
    margin: "0 0 6px 0",
  },
  stepDescription: {
    fontSize: "12px",
    color: "#A1A1AA",
    lineHeight: "1.5",
    margin: "0 0 12px 0",
  },
  stepParamsBox: {
    background: "rgba(9, 9, 11, 0.7)",
    borderRadius: "6px",
    padding: "8px 10px",
  },
  paramsLabel: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#71717A",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "4px",
  },
  paramsPre: {
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#C4B5FD",
    margin: 0,
    overflowX: "auto",
    maxHeight: "140px",
  },
  approvalActionsBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
  },
  statCard: {
    background: "rgba(24, 24, 27, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "10px",
    padding: "14px",
  },
  metricLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#71717A",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "4px",
  },
  metricValue: {
    fontSize: "14px",
    fontWeight: "750",
    color: "#FFFFFF",
    margin: 0,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#FFFFFF",
    display: "block",
  },
  statSubValue: {
    fontSize: "13px",
    color: "#71717A",
    fontWeight: "600",
  },
  subText: {
    fontSize: "11px",
    color: "#A1A1AA",
    marginTop: "4px",
    display: "block",
  },
  actionPromptCard: {
    background: "linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(79, 70, 229, 0.06))",
    border: "1px solid rgba(139, 92, 246, 0.35)",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(124, 58, 237, 0.15)",
  },
  actionPromptHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "12px",
  },
  actionIconContainer: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "rgba(139, 92, 246, 0.25)",
    border: "1px solid rgba(139, 92, 246, 0.5)",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
    color: "#C4B5FD",
    flexShrink: 0,
  },
  actionEyebrow: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#C4B5FD",
    display: "block",
    marginBottom: "2px",
  },
  actionTitle: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: 0,
  },
  actionReasoning: {
    fontSize: "13px",
    color: "#D4D4D8",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
  },
  decisionParamsBox: {
    background: "rgba(9, 9, 11, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "8px",
    padding: "10px 14px",
    marginBottom: "18px",
  },
  actionButtonsRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  terminalAlert: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "18px 22px",
    borderRadius: "12px",
    background: "rgba(24, 24, 27, 0.85)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    flexWrap: "wrap",
  },
  terminalAlertIcon: {
    fontSize: "24px",
    color: "#FDBA74",
  },
  terminalAlertTitle: {
    fontSize: "15px",
    fontWeight: "750",
    color: "#FFFFFF",
    margin: "0 0 4px 0",
  },
  terminalAlertText: {
    fontSize: "12px",
    color: "#A1A1AA",
    margin: 0,
    lineHeight: "1.5",
  },
  sectionHeader: {
    fontSize: "16px",
    fontWeight: "750",
    color: "#FFFFFF",
    margin: 0,
  },
  textToggleButton: {
    background: "transparent",
    border: "none",
    color: "#A78BFA",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  stepsTimeline: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  timelineItem: {
    display: "flex",
    gap: "14px",
    position: "relative",
  },
  timelineLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "4px",
  },
  timelineDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  timelineContent: {
    flex: 1,
    background: "rgba(9, 9, 11, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "10px",
    padding: "12px 16px",
  },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  stepBadge: {
    fontSize: "10px",
    fontWeight: "800",
    background: "rgba(255, 255, 255, 0.08)",
    padding: "2px 6px",
    borderRadius: "4px",
    color: "#D4D4D8",
  },
  stepTitle: {
    fontSize: "13px",
    color: "#FFFFFF",
  },
  statusPill: {
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stepErrorText: {
    fontSize: "12px",
    color: "#FCA5A5",
    margin: "6px 0 0 0",
  },
  detailsToggle: {
    background: "transparent",
    border: "none",
    color: "#A78BFA",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    padding: 0,
    marginTop: "6px",
  },
  expandedOutputBox: {
    marginTop: "10px",
    background: "rgba(0, 0, 0, 0.5)",
    borderRadius: "6px",
    padding: "10px",
  },
  verdictHeroCard: {
    background: "radial-gradient(circle at top right, rgba(124, 58, 237, 0.18), transparent 45%), rgba(18, 18, 23, 0.9)",
    border: "1px solid rgba(139, 92, 246, 0.35)",
    borderRadius: "18px",
    padding: "32px",
    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
  },
  verdictTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    gap: "16px",
    flexWrap: "wrap",
  },
  verdictGoalText: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: 0,
    letterSpacing: "-0.5px",
  },
  verdictBadge: {
    padding: "8px 18px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
  },
  verdictSummary: {
    fontSize: "15px",
    color: "#D4D4D8",
    lineHeight: "1.7",
    marginBottom: "28px",
  },
  scoreGaugesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    paddingTop: "24px",
  },
  gaugeBox: {
    background: "rgba(9, 9, 11, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "12px",
    padding: "16px",
  },
  scoreRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    marginTop: "6px",
  },
  scoreBig: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scoreDenominator: {
    fontSize: "14px",
    color: "#71717A",
    fontWeight: "700",
  },
  progressBarBg: {
    height: "6px",
    borderRadius: "3px",
    background: "rgba(255, 255, 255, 0.08)",
    marginTop: "10px",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: "3px",
    background: "linear-gradient(90deg, #7C3AED, #10B981)",
  },
  localEvidenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    margin: "16px 0",
  },
  sentimentBox: {
    background: "rgba(9, 9, 11, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "12px",
    padding: "18px",
    marginTop: "16px",
  },
  sentimentTitle: {
    fontSize: "14px",
    fontWeight: "750",
    color: "#FFFFFF",
    margin: "0 0 8px 0",
  },
  sentimentSummaryText: {
    fontSize: "13px",
    color: "#D4D4D8",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
  },
  sentimentPillsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sentimentCategory: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  tagWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  greenTag: {
    padding: "4px 10px",
    borderRadius: "6px",
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    color: "#86EFAC",
    fontSize: "12px",
    fontWeight: "600",
  },
  redTag: {
    padding: "4px 10px",
    borderRadius: "6px",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#FCA5A5",
    fontSize: "12px",
    fontWeight: "600",
  },
  violetTag: {
    padding: "4px 10px",
    borderRadius: "6px",
    background: "rgba(124, 58, 237, 0.12)",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    color: "#C4B5FD",
    fontSize: "12px",
    fontWeight: "600",
  },
  techTag: {
    padding: "6px 12px",
    borderRadius: "8px",
    background: "rgba(79, 70, 229, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    color: "#A5B4FC",
    fontSize: "12px",
    fontWeight: "600",
  },
  neutralTag: {
    padding: "4px 10px",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#D4D4D8",
    fontSize: "12px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  riskList: {
    listStyle: "none",
    padding: 0,
    margin: "14px 0 0 0",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  riskItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    color: "#E4E4E7",
    lineHeight: "1.5",
  },
  riskBullet: {
    color: "#FCA5A5",
    fontSize: "14px",
    flexShrink: 0,
  },
  recList: {
    listStyle: "none",
    padding: 0,
    margin: "14px 0 0 0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  recItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    background: "rgba(9, 9, 11, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  recNumber: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "rgba(124, 58, 237, 0.2)",
    color: "#C4B5FD",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: "800",
    flexShrink: 0,
  },
  recText: {
    fontSize: "13px",
    color: "#E4E4E7",
    lineHeight: "1.6",
  },
  auditMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginTop: "12px",
  },
  bottomBar: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "12px",
  },
  spinner: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTopColor: "#FFFFFF",
    display: "inline-block",
    animation: "spin 0.8s linear infinite",
  },
};

export default Agent;
