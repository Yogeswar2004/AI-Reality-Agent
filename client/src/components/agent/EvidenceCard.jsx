import { Database, Star, ThumbsUp, ThumbsDown, Lightbulb } from "lucide-react";
import CacheBadge from "./CacheBadge";

function EvidenceCard({ item }) {
  if (!item) return null;

  const { evidenceType, extractedData, metadata, createdAt } = item;
  const isCached = metadata?.isCached;
  const cachedAt = metadata?.cachedAt;
  const networkCallMade = metadata?.networkCallMade;

  const renderContent = () => {
    switch (evidenceType) {
      case "competitor_discovery": {
        const competitors = extractedData?.competitors || [];
        const count = extractedData?.count ?? competitors.length;
        const radius = extractedData?.searchRadius;
        const avgRating = extractedData?.density?.averageRating;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 120px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Found Competitors</span>
                <strong style={{ fontSize: "16px", color: "var(--text-primary)" }}>{count}</strong>
              </div>
              {radius && (
                <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Search Radius</span>
                  <strong style={{ fontSize: "16px", color: "var(--text-primary)" }}>{radius}m</strong>
                </div>
              )}
              {avgRating && (
                <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Average Rating</span>
                  <strong style={{ fontSize: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "3px" }}>
                    {avgRating} <Star size={12} fill="#FCD34D" stroke="#FCD34D" />
                  </strong>
                </div>
              )}
            </div>

            {competitors.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                  Sampled Businesses:
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {competitors.slice(0, 4).map((comp, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        background: "var(--bg-elevated)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{comp.name}</span>
                      <span style={{ color: "#fcd34d", display: "flex", alignItems: "center", gap: "2px" }}>
                        {comp.rating ? `${comp.rating} ★` : "No rating"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case "sentiment_analysis": {
        const { strengths = [], weaknesses = [], opportunities = [], overallSentiment, reviewsAnalyzed } = extractedData || {};

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--text-secondary)" }}>
                Overall: <strong style={{ color: "var(--text-primary)" }}>{overallSentiment || "Evaluated"}</strong>
              </span>
              {reviewsAnalyzed !== undefined && (
                <span style={{ color: "var(--text-muted)" }}>{reviewsAnalyzed} reviews analyzed</span>
              )}
            </div>

            {strengths.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--status-viable)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                  <ThumbsUp size={11} /> Competitor Strengths:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {strengths.map((s, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "var(--radius-xs)", background: "rgba(34, 197, 94, 0.12)", color: "#86efac" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {weaknesses.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--status-danger)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                  <ThumbsDown size={11} /> Customer Complaints:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {weaknesses.map((w, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "var(--radius-xs)", background: "rgba(239, 68, 68, 0.12)", color: "#fca5a5" }}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {opportunities.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--primary-light)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                  <Lightbulb size={11} /> Market Opportunities / Unmet Needs:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {opportunities.map((o, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "var(--radius-xs)", background: "rgba(124, 58, 237, 0.15)", color: "#c4b5fd" }}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case "tech_assessment": {
        const { feasibility, complexity, suggestedStack = [] } = extractedData || {};

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {feasibility && (
                <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Feasibility</span>
                  <strong style={{ fontSize: "14px", color: "var(--status-viable)" }}>{feasibility}</strong>
                </div>
              )}
              {complexity && (
                <div style={{ padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Complexity</span>
                  <strong style={{ fontSize: "14px", color: "var(--status-warning)" }}>{complexity}</strong>
                </div>
              )}
            </div>

            {suggestedStack.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Recommended Stack:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {suggestedStack.map((tech, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "var(--radius-xs)", background: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)" }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case "customer_reviews": {
        const businessName = extractedData?.businessName || "Competitor";
        const reviews = extractedData?.reviews || [];

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Sampled reviews for <strong style={{ color: "var(--text-primary)" }}>{businessName}</strong> ({reviews.length} reviews fetched)
            </span>
            {reviews.slice(0, 2).map((rev, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 10px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                }}
              >
                "{rev.text?.slice(0, 140)}..."
              </div>
            ))}
          </div>
        );
      }

      default:
        return (
          <pre style={{ fontSize: "11px", color: "var(--text-secondary)", overflowX: "auto", margin: 0 }}>
            {JSON.stringify(extractedData, null, 2)}
          </pre>
        );
    }
  };

  const formatTypeLabel = (type) => {
    switch (type) {
      case "competitor_discovery":
        return "Market & Competitor Discovery";
      case "sentiment_analysis":
        return "Customer Sentiment Intelligence";
      case "tech_assessment":
        return "Technical Feasibility Assessment";
      case "customer_reviews":
        return "Grounded Customer Reviews";
      default:
        return type.replace("_", " ").toUpperCase();
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Database size={13} style={{ color: "var(--primary-light)" }} />
          <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            {formatTypeLabel(evidenceType)}
          </strong>
        </div>

        <CacheBadge
          isCached={isCached}
          networkCallMade={networkCallMade}
          cachedAt={cachedAt}
          size="xs"
        />
      </div>

      {renderContent()}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          color: "var(--text-muted)",
          paddingTop: "6px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <span>Verified Grounded Evidence</span>
        <span>{createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </div>
    </div>
  );
}

export default EvidenceCard;
