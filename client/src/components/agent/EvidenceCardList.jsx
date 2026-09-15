import { Database } from "lucide-react";
import EvidenceCard from "./EvidenceCard";
import EmptyState from "../common/EmptyState";

function EvidenceCardList({ evidence = [], loading = false }) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px 0" }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: "120px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}
          />
        ))}
      </div>
    );
  }

  if (!evidence || evidence.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Database size={20} />}
        title="No grounded evidence yet"
        description="Run investigation tools to extract verified market, competitor, and customer evidence."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
          Extracted Grounded Evidence ({evidence.length})
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {evidence.map((item, idx) => (
          <EvidenceCard key={item._id || idx} item={item} />
        ))}
      </div>
    </div>
  );
}

export default EvidenceCardList;

