import Badge from "../common/Badge";
import { CheckCircle2, AlertCircle, Clock, Pause, ShieldAlert, Sparkles } from "lucide-react";

const getStateConfig = (state) => {
  switch (state) {
    case "completed":
      return {
        variant: "viable",
        label: "Completed",
        icon: <CheckCircle2 size={13} />,
        description: "Investigation completed and viability verdict synthesized.",
      };
    case "executing":
      return {
        variant: "primary",
        label: "Executing",
        icon: <Sparkles size={13} />,
        description: "Agent is actively running authorized investigation tools.",
      };
    case "synthesizing":
      return {
        variant: "info",
        label: "Synthesizing",
        icon: <Sparkles size={13} />,
        description: "Aggregating multi-domain evidence to generate final verdict.",
      };
    case "awaiting_approval":
      return {
        variant: "warning",
        label: "Awaiting Approval",
        icon: <Clock size={13} />,
        description: "Advisory plan generated. Awaiting human authorization to proceed.",
      };
    case "awaiting_clarification":
      return {
        variant: "info",
        label: "Needs Clarification",
        icon: <AlertCircle size={13} />,
        description: "Agent paused to request clarification on ambiguous requirements.",
      };
    case "quota_limited":
      return {
        variant: "quota",
        label: "Budget Ceiling Reached",
        icon: <ShieldAlert size={13} />,
        description: "Step or API call limit reached. Further execution stopped to protect quotas.",
      };
    case "failed":
      return {
        variant: "danger",
        label: "Failed",
        icon: <AlertCircle size={13} />,
        description: "An unrecoverable system or provider error halted this investigation.",
      };
    case "cancelled":
      return {
        variant: "default",
        label: "Cancelled",
        icon: <Pause size={13} />,
        description: "Investigation safely stopped by user or agent controlled conclusion.",
      };
    case "planning":
      return {
        variant: "primary",
        label: "Planning",
        icon: <Sparkles size={13} />,
        description: "Formulating advisory tool sequence and hypothesis.",
      };
    case "draft":
    default:
      return {
        variant: "default",
        label: "Draft",
        icon: <Clock size={13} />,
        description: "Venture parameters defined. Ready to generate research plan.",
      };
  }
};

function RunStatus({ state = "draft", compact = false }) {
  const config = getStateConfig(state);

  if (compact) {
    return (
      <Badge variant={config.variant} size="sm">
        {config.icon}
        {config.label}
      </Badge>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Badge variant={config.variant} size="md">
          {config.icon}
          {config.label}
        </Badge>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
        {config.description}
      </p>
    </div>
  );
}

export default RunStatus;
