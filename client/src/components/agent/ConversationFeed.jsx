import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { useAgent } from "../../context/useAgent";
import MessageBubble from "./MessageBubble";
import RunControllerBar from "./RunControllerBar";
import LocationInput from "./LocationInput";
import Button from "../common/Button";

const PRESET_GOALS = [
  {
    label: "Artisanal Bakery",
    goal: "Open an artisanal sourdough bakery and specialty espresso bar",
    location: "Denver, CO",
    coordinates: { latitude: 39.7392, longitude: -104.9903 },
  },
  {
    label: "AI Code Review SaaS",
    goal: "Build an automated pull request security and code documentation generator",
    location: "",
    coordinates: null,
  },
  {
    label: "Boutique Climbing Gym",
    goal: "Open a boutique bouldering gym with community workspace",
    location: "Boulder, CO",
    coordinates: { latitude: 40.015, longitude: -105.2705 },
  },
  {
    label: "Cold-Pressed Juice Delivery",
    goal: "Subscription cold-pressed organic juice delivery service",
    location: "Austin, TX",
    coordinates: { latitude: 30.2672, longitude: -97.7431 },
  },
];

function ConversationFeed() {
  const {
    messages,
    run,
    plan,
    sendMessage,
    startNewInvestigation,
    approvePlan,
    executeNextStep,
    retryStep,
    resumeRun,
    submitClarification,
    synthesizeVerdict,
    cancelActiveRun,
    loadingAction,
    error,
    clearError,
    setActiveTab,
  } = useAgent();

  // Setup input state (when starting a new investigation)
  const [goalInput, setGoalInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

  // Chat message input state
  const [chatInput, setChatInput] = useState("");

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, run?.currentDecision, run?.state]);

  const handleStartSetup = (e) => {
    if (e) e.preventDefault();
    if (!goalInput.trim()) return;

    let payloadLocation = null;
    if (locationInput && typeof locationInput === "object") {
      payloadLocation = locationInput;
    } else if (typeof locationInput === "string" && locationInput.trim()) {
      payloadLocation = locationInput.trim();
    }

    startNewInvestigation({ goal: goalInput, location: payloadLocation });
  };

  const handleSendChat = (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || loadingAction) return;
    const text = chatInput.trim();
    setChatInput("");
    sendMessage(text);
  };

  const isSetupMode = !run && messages.length === 0;

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-app)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Error alert toast */}
      {error && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            background: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "var(--status-danger)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            style={{ color: "inherit", fontWeight: "700", padding: "0 4px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Stream Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {isSetupMode ? (
          /* ==================== SETUP STAGE ==================== */
          <div
            style={{
              maxWidth: "680px",
              margin: "auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              padding: "20px 0",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--primary-subtle)",
                  color: "var(--primary-light)",
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "12px",
                }}
              >
                <Sparkles size={12} /> Autonomous Venture Discovery
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
                What venture should the agent investigate?
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.6" }}>
                Formulates an advisory research plan, executes domain intelligence tools with human-in-the-loop authorization, and synthesizes grounded viability verdicts.
              </p>
            </div>

            {/* Quick Presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-muted)" }}>
                Quick Presets:
              </span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setGoalInput(preset.goal);
                      if (preset.coordinates) {
                        setLocationInput({
                          latitude: preset.coordinates.latitude,
                          longitude: preset.coordinates.longitude,
                          label: preset.location,
                        });
                      } else {
                        setLocationInput(preset.location);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleStartSetup}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Venture Goal or Business Hypothesis <span style={{ color: "var(--status-danger)" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="e.g. Evaluate whether launching a specialty coffee roastery with cold brew subscription is viable in Portland, OR."
                  disabled={loadingAction === "initializing" || loadingAction === "planning"}
                  style={{
                    width: "100%",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 14px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <LocationInput
                location={locationInput}
                onChange={setLocationInput}
                disabled={loadingAction === "initializing" || loadingAction === "planning"}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!goalInput.trim() || Boolean(loadingAction)}
                loading={loadingAction === "initializing" || loadingAction === "planning"}
                icon={<Sparkles size={16} />}
                style={{ width: "100%", justifyContent: "center", marginTop: "4px" }}
              >
                {loadingAction === "planning"
                  ? "Formulating Advisory Plan..."
                  : "Initialize Investigation Plan"}
              </Button>
            </form>
          </div>
        ) : (
          /* ==================== ACTIVE CONVERSATION STREAM ==================== */
          <>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg._id || idx}
                message={msg}
                run={run}
                plan={plan}
                onApprovePlan={approvePlan}
                onCancelPlan={cancelActiveRun}
                onSubmitClarification={submitClarification}
                onViewVerdict={() => setActiveTab("verdict")}
                loadingAction={loadingAction}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Controller bar for executing next tool or resuming when investigation is active or halted */}
      {!isSetupMode &&
        run &&
        (run.state === "executing" ||
          run.state === "cancelled" ||
          run.state === "failed" ||
          run.state === "quota_limited") &&
        run.currentDecision?.action !== "ASK_USER" && (
          <div style={{ padding: "0 20px 10px" }}>
            <RunControllerBar
              run={run}
              onExecuteStep={executeNextStep}
              onRetryStep={retryStep}
              onResume={resumeRun}
              onSynthesize={synthesizeVerdict}
              onCancel={cancelActiveRun}
              loading={
                loadingAction === "executing_step" ||
                loadingAction === "synthesizing" ||
                loadingAction === "retrying_step" ||
                loadingAction === "resuming_run"
              }
            />
          </div>
        )}

      {/* Chat Message Input Bar (when thread is active) */}
      {!isSetupMode && (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
          }}
        >
          <form
            onSubmit={handleSendChat}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message your agent (answers, pivot ideas, questions)..."
              disabled={Boolean(loadingAction)}
              style={{
                flex: 1,
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "11px 16px",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!chatInput.trim() || Boolean(loadingAction)}
              loading={loadingAction === "sending_message"}
              icon={<Send size={15} />}
            >
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ConversationFeed;
