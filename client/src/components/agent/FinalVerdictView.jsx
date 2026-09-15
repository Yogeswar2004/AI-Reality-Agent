import { ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Cpu, Compass, RotateCcw } from "lucide-react";
import Badge from "../common/Badge";
import Button from "../common/Button";
import ProgressBar from "../common/ProgressBar";

function FinalVerdictView({ output, run, onReset }) {
  if (!output) return null;

  const getVerdictBadge = (verdict) => {
    switch (verdict) {
      case "VIABLE":
      case "STRONG_VIABILITY":
        return { variant: "viable", label: "Viable Opportunity", icon: <CheckCircle2 size={16} /> };
      case "NEEDS_REFINEMENT":
      case "MODERATE_VIABILITY":
        return { variant: "warning", label: "Needs Refinement", icon: <AlertTriangle size={16} /> };
      case "HIGH_RISK":
        return { variant: "danger", label: "High Risk", icon: <ShieldCheck size={16} /> };
      default:
        return { variant: "default", label: verdict || "Inconclusive", icon: <Compass size={16} /> };
    }
  };

  const badgeConfig = getVerdictBadge(output.verdict);
  const confidenceScore = output.confidenceScore ?? 0;
  const marketFitScore = output.marketFit?.score ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s ease-out" }}>
      {/* Hero Scorecard */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(24, 24, 36, 0.8), rgba(14, 14, 22, 0.95))",
          border: "1px solid var(--border-active)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--primary-light)",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Synthesized Viability Assessment
            </span>
            <h3 style={{ fontSize: "16px", fontWeight: "750", color: "var(--text-primary)", margin: 0 }}>
              {run?.goal || "Venture Investigation"}
            </h3>
          </div>

          <Badge variant={badgeConfig.variant} size="md">
            {badgeConfig.icon}
            {badgeConfig.label}
          </Badge>
        </div>

        {/* Executive Summary */}
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
          {output.summary}
        </p>

        {/* Key Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ padding: "10px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Confidence Score</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "4px 0" }}>
              <strong style={{ fontSize: "20px", color: "var(--text-primary)" }}>{confidenceScore}</strong>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>/ 10</span>
            </div>
            <ProgressBar value={confidenceScore} max={10} height={4} color="var(--primary-gradient)" />
          </div>

          {marketFitScore !== null && (
            <div style={{ padding: "10px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Market Fit</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "4px 0" }}>
                <strong style={{ fontSize: "20px", color: "var(--text-primary)" }}>{marketFitScore}</strong>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>/ 10</span>
              </div>
              <ProgressBar value={marketFitScore} max={10} height={4} color="linear-gradient(135deg, #10b981, #059669)" />
            </div>
          )}

          {output.feasibility && (
            <div style={{ padding: "10px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Technical Feasibility</span>
              <strong style={{ fontSize: "14px", color: "var(--primary-light)", display: "block", marginTop: "6px" }}>
                {output.feasibility}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Local Evidence Summary if present */}
      {output.localEvidence && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>
            Market Discovery Findings
          </span>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px" }}>
            <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 110px" }}>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px" }}>Competitors</span>
              <strong style={{ color: "var(--text-primary)" }}>{output.localEvidence.competitorCount ?? 0}</strong>
            </div>
            <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 110px" }}>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px" }}>Avg Rating</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {output.localEvidence.averageCompetitorRating ? `${output.localEvidence.averageCompetitorRating} ★` : "N/A"}
              </strong>
            </div>
            <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 110px" }}>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px" }}>Total Reviews</span>
              <strong style={{ color: "var(--text-primary)" }}>{output.localEvidence.totalCompetitorReviews ?? 0}</strong>
            </div>
          </div>

          {output.localEvidence.sentimentSummary && (
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0", lineHeight: "1.5" }}>
              {output.localEvidence.sentimentSummary}
            </p>
          )}
        </div>
      )}

      {/* Recommended Architecture / Tech Stack */}
      {output.suggestedStack?.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Cpu size={14} style={{ color: "var(--primary-light)" }} />
            <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
              Recommended Architecture & Tech Stack
            </strong>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {output.suggestedStack.map((tech, i) => (
              <span
                key={i}
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Risks */}
      {output.keyRisks?.length > 0 && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={14} style={{ color: "var(--status-danger)" }} />
            <strong style={{ fontSize: "12px", color: "var(--status-danger)" }}>
              Critical Identified Risks
            </strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
            {output.keyRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Plan */}
      {output.recommendations?.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp size={14} style={{ color: "var(--status-viable)" }} />
            <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
              Prioritized Strategic Action Plan
            </strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {output.recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ color: "var(--primary-light)", fontWeight: "700" }}>{i + 1}.</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action footer */}
      {onReset && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px" }}>
          <Button
            variant="secondary"
            size="md"
            onClick={onReset}
            icon={<RotateCcw size={15} />}
          >
            Start Another Investigation
          </Button>
        </div>
      )}
    </div>
  );
}

export default FinalVerdictView;
