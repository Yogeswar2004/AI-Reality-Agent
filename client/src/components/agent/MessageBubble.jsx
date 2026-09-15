import { Bot, User, CheckCircle2, Sparkles } from "lucide-react";
import PlanApprovalCard from "./PlanApprovalCard";
import ClarificationCard from "./ClarificationCard";
import ReplanNotice from "./ReplanNotice";
import Button from "../common/Button";

function MessageBubble({
  message,
  run,
  plan,
  onApprovePlan,
  onCancelPlan,
  onSubmitClarification,
  onViewVerdict,
  loadingAction,
}) {
  if (!message) return null;

  const { sender = "user", messageType = "text", content, createdAt, metadata } = message;
  const isUser = sender === "user";
  const isSystem = sender === "system";

  const formattedTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: "4px",
        width: "100%",
      }}
    >
      {/* Sender indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 4px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "var(--radius-xs)",
            background: isUser ? "var(--primary-subtle)" : "rgba(255, 255, 255, 0.08)",
            color: isUser ? "var(--primary-light)" : "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isUser ? <User size={10} /> : <Bot size={10} />}
        </div>
        <strong style={{ color: isUser ? "var(--primary-light)" : "var(--text-secondary)" }}>
          {isUser ? "You" : isSystem ? "System" : "Reality Agent"}
        </strong>
        <span>•</span>
        <span>{formattedTime}</span>
      </div>

      {/* Main Message Body based on type */}
      <div
        style={{
          maxWidth: isUser ? "85%" : "100%",
          width: isUser ? "auto" : "100%",
        }}
      >
        {messageType === "plan_proposal" && (
          <PlanApprovalCard
            plan={plan || metadata?.plan}
            run={run}
            onApprove={onApprovePlan}
            onCancel={onCancelPlan}
            loading={loadingAction === "approving"}
          />
        )}

        {messageType === "clarification_question" && (
          <ClarificationCard
            clarification={run?.clarification || metadata?.clarification || { question: content }}
            onSubmit={onSubmitClarification}
            onCancel={onCancelPlan}
            loading={loadingAction === "submitting_clarification"}
          />
        )}

        {messageType === "replan_notice" && (
          <ReplanNotice
            reason={content}
            replanCount={metadata?.replanCount || run?.replanCount || 1}
            steps={metadata?.steps || []}
          />
        )}

        {messageType === "plan_approval" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--status-viable-bg)",
              border: "1px solid var(--status-viable-border)",
              color: "var(--status-viable)",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            <CheckCircle2 size={14} />
            <span>{content}</span>
          </div>
        )}

        {messageType === "clarification_answer" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#93c5fd",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            <span>Response: <strong>{content}</strong></span>
          </div>
        )}

        {messageType === "final_verdict" && (
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-active)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={15} style={{ color: "var(--primary-light)" }} />
              <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                Final Investigation Recommendation Ready
              </strong>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              {content}
            </p>
            {onViewVerdict && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="primary" size="sm" onClick={onViewVerdict}>
                  View Full Verdict Report
                </Button>
              </div>
            )}
          </div>
        )}

        {messageType === "text" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: isUser
                ? "var(--radius-md) var(--radius-xs) var(--radius-md) var(--radius-md)"
                : "var(--radius-xs) var(--radius-md) var(--radius-md) var(--radius-md)",
              background: isUser ? "var(--primary-subtle)" : "var(--bg-elevated)",
              border: `1px solid ${isUser ? "rgba(139, 92, 246, 0.35)" : "var(--border-subtle)"}`,
              color: "var(--text-primary)",
              fontSize: "13px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
