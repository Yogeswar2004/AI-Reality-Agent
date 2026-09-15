import { useState } from "react";
import { HelpCircle, Send } from "lucide-react";
import Button from "../common/Button";
import Badge from "../common/Badge";

function ClarificationCard({
  clarification,
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [answer, setAnswer] = useState("");

  if (!clarification) return null;

  const question = clarification.question || "Clarification needed to proceed with investigation.";
  const options = Array.isArray(clarification.options) ? clarification.options : [];
  const reasoning = clarification.reasoning || null;

  const handleSelectOption = (opt) => {
    setAnswer(opt);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!answer.trim() || loading) return;
    onSubmit(answer.trim());
  };

  return (
    <div
      style={{
        background: "rgba(30, 58, 138, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        animation: "fadeIn 0.25s ease-out forwards",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(59, 130, 246, 0.2)",
            color: "var(--status-info)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HelpCircle size={15} />
        </div>
        <div>
          <Badge variant="info" size="xs">
            Clarification Required
          </Badge>
          <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginTop: "2px" }}>
            {question}
          </h4>
        </div>
      </div>

      {reasoning && (
        <p style={{ fontSize: "12px", color: "#93c5fd", margin: 0, lineHeight: "1.5" }}>
          {reasoning}
        </p>
      )}

      {/* Suggested option chips */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Suggested Answers:
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {options.map((opt, idx) => {
              const isSelected = answer === opt;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(opt)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "12px",
                    fontWeight: isSelected ? "700" : "500",
                    background: isSelected ? "rgba(59, 130, 246, 0.35)" : "rgba(255, 255, 255, 0.05)",
                    color: isSelected ? "#ffffff" : "var(--text-secondary)",
                    border: `1px solid ${isSelected ? "var(--status-info)" : "var(--border-subtle)"}`,
                    cursor: "pointer",
                    transition: "var(--transition-fast)",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            maxLength={500}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              options.length > 0
                ? "Select a suggested option above or type your answer..."
                : "Type your response to the agent's question..."
            }
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {answer.length}/500 chars
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel Run
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!answer.trim() || loading}
              loading={loading}
              icon={<Send size={13} />}
              style={{
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              }}
            >
              Submit & Resume
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default ClarificationCard;

