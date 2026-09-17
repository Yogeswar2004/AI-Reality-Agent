import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

function MyIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const response = await api.get("/ideas");
        setIdeas(response.data.ideas || []);
      } catch (error) {
        console.error("Fetch ideas error:", error);

        setError(
          error.response?.data?.message ||
          "Failed to load your ideas"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIdeas();
  }, []);

  const handleDelete = async (ideaId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this idea? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(ideaId);

      await api.delete(`/ideas/${ideaId}`);

      setIdeas((currentIdeas) =>
        currentIdeas.filter((idea) => idea._id !== ideaId)
      );
    } catch (error) {
      console.error("Delete idea error:", error);

      alert(
        error.response?.data?.message ||
        "Failed to delete idea"
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="my-ideas-page">
        <div className="my-ideas-loading-container">
          <div className="my-ideas-loading-icon">✦</div>

          <h2>Loading your ideas...</h2>

          <p>
            Getting your saved ideas from the database.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-ideas-page">
        <div className="my-ideas-error-container">
          <div className="my-ideas-error-icon">⚠️</div>

          <p className="my-ideas-label">MY IDEAS</p>

          <h2>Unable to load your ideas</h2>

          <p>{error}</p>

          <Link
            to="/dashboard"
            className="my-ideas-back-button"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const analyzedCount = ideas.filter(
    (idea) => idea.analysis
  ).length;

  const notAnalyzedCount = ideas.filter(
    (idea) => !idea.analysis
  ).length;

  return (
    <div className="my-ideas-page">
      <div className="my-ideas-container">

        {/* HEADER */}
        <div className="my-ideas-header">
          <div>
            <p className="my-ideas-label">MY IDEAS</p>

            <h1>Your project ideas</h1>

            <p className="my-ideas-subtitle">
              View, analyze, and manage all your saved
              project ideas.
            </p>
          </div>

          <Link
            to="/agent"
            className="my-ideas-analyze-button"
          >
            <span>+</span>
            Analyze New Idea
          </Link>
        </div>

        {/* SUMMARY */}
        <div className="my-ideas-summary">
          <div className="summary-item">
            <span>Total Ideas</span>
            <strong>{ideas.length}</strong>
          </div>

          <div className="summary-divider" />

          <div className="summary-item">
            <span>Analyzed</span>
            <strong>{analyzedCount}</strong>
          </div>

          <div className="summary-divider" />

          <div className="summary-item">
            <span>Not Analyzed</span>
            <strong>{notAnalyzedCount}</strong>
          </div>
        </div>

        {/* EMPTY STATE */}
        {ideas.length === 0 ? (
          <div className="my-ideas-empty">
            <div className="my-ideas-empty-icon">
              ✦
            </div>

            <p className="my-ideas-label">
              GET STARTED
            </p>

            <h2>No ideas yet</h2>

            <p>
              You have not analyzed any project ideas yet.
              Start by entering an idea and let IdeaReality
              evaluate its potential.
            </p>

            <Link
              to="/agent"
              className="my-ideas-empty-button"
            >
              Analyze Your First Idea
              <span>→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* COLLECTION HEADER */}
            <div className="my-ideas-section-header">
              <div>
                <p className="my-ideas-label">
                  YOUR COLLECTION
                </p>

                <h2>Saved ideas</h2>
              </div>

              <span className="my-ideas-count">
                {ideas.length}{" "}
                {ideas.length === 1 ? "idea" : "ideas"}
              </span>
            </div>

            {/* IDEAS GRID */}
            <div className="my-ideas-grid">
              {ideas.map((idea) => {
                const isAgent = idea.source === "agent_studio" || idea.isAgentRun;
                const isAnalyzed = Boolean(
                  idea.analysis
                );

                const isLocal =
                  idea.analysisMode === "local";

                /*
                 * Overall score
                 */
                const overallScore =
                  idea.analysis?.overallScore ??
                  idea.analysis?.opportunityScore ??
                  null;

                /*
                 * Competition score
                 */
                const competitionScore = isLocal
                  ? (
                    idea.analysis?.competition?.score ??
                    idea.analysis?.competitionScore ??
                    null
                  )
                  : null;

                const rawLevel = isLocal
                  ? (
                    idea.analysis?.competition?.level ??
                    null
                  )
                  : null;

                const competitionLevel =
                  typeof rawLevel === "string" ? rawLevel : null;

                const density = isLocal
                  ? (
                    (rawLevel && typeof rawLevel === "object")
                      ? rawLevel
                      : (idea.analysis?.localEvidence?.competitorDensity && typeof idea.analysis?.localEvidence?.competitorDensity === "object")
                      ? idea.analysis.localEvidence.competitorDensity
                      : null
                  )
                  : null;

                const hasDensity = Boolean(
                  density &&
                  (density.within500m !== undefined ||
                   density.within1km !== undefined ||
                   density.within3km !== undefined)
                );

                return (
                  <div
                    className={`my-idea-card ${isLocal
                        ? "local-idea-card"
                        : ""
                      }`}
                    key={idea._id}
                  >

                    {/* CARD TOP */}
                    <div className="my-idea-card-top">

                      <div className="my-idea-tags">
                        {isAgent && (
                          <span
                            className="my-idea-agent"
                            style={{
                              background: "rgba(139, 92, 246, 0.15)",
                              color: "var(--primary-light, #a78bfa)",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              borderRadius: "var(--radius-xs)",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: "700",
                            }}
                          >
                            🤖 Agent Studio
                          </span>
                        )}

                        <span className="my-idea-category">
                          {idea.businessType || idea.category || "General"}
                        </span>

                        {isLocal && (
                          <span className="my-idea-local">
                            📍 Local
                          </span>
                        )}
                      </div>

                      {/* OVERALL SCORE / CONFIDENCE */}
                      {isAgent ? (
                        <div
                          className={`my-idea-score ${
                            isAnalyzed ? "has-score" : "no-score"
                          }`}
                          style={{ minWidth: "90px", padding: "6px 10px" }}
                        >
                          {isAnalyzed ? (
                            <>
                              <div
                                className="score-number"
                                style={{
                                  fontSize: "16px",
                                  color: "var(--primary-light, #a78bfa)",
                                }}
                              >
                                {idea.analysis?.confidenceScore !== null &&
                                idea.analysis?.confidenceScore !== undefined
                                  ? `${idea.analysis.confidenceScore}/10`
                                  : "VERIFIED"}
                              </div>
                              <div
                                className="score-total"
                                style={{ fontSize: "9px" }}
                              >
                                CONFIDENCE
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className="score-number"
                                style={{ fontSize: "11px", color: "#60a5fa" }}
                              >
                                {idea.agentState
                                  ? idea.agentState
                                      .toUpperCase()
                                      .replace(/_/g, " ")
                                  : "AGENT"}
                              </div>
                              <div
                                className="score-total"
                                style={{ fontSize: "9px" }}
                              >
                                STATUS
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`my-idea-score ${
                            isAnalyzed ? "has-score" : "no-score"
                          }`}
                        >
                          <div className="score-number">
                            {overallScore ?? "--"}
                          </div>

                          <div className="score-total">
                            /100
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TITLE */}
                    <h2 className="my-idea-title">
                      {idea.title}
                    </h2>

                    {/* DESCRIPTION */}
                    <p className="my-idea-description">
                      {idea.description?.length > 150
                        ? `${idea.description.slice(
                          0,
                          150
                        )}...`
                        : idea.description ||
                        "No description provided."}
                    </p>

                    {/* LOCAL BUSINESS INFORMATION */}
                    {isLocal && (
                      <div className="local-analysis-box">

                        {/* COMPETITION SCORE */}
                        <div className="local-analysis-item">
                          <div className="local-analysis-heading">
                            <span>
                              Competition
                            </span>

                            <span className="local-analysis-icon">
                              ⚔
                            </span>
                          </div>

                          <div
                            className="local-analysis-score"
                            style={
                              isAgent && competitionScore === null && !competitionLevel
                                ? { fontSize: "16px" }
                                : undefined
                            }
                          >
                            {competitionScore !== null
                              ? `${competitionScore}/100`
                              : competitionLevel || (isAgent ? "Evaluated" : "--")}
                          </div>

                          {competitionLevel && competitionScore !== null && (
                            <div
                              className={`competition-level ${competitionLevel
                                .toLowerCase()
                                .replace(
                                  /\s+/g,
                                  "-"
                                )}`}
                            >
                              {competitionLevel}
                            </div>
                          )}

                          {hasDensity && (
                            <div
                              className="local-analysis-density"
                              style={{
                                marginTop: "6px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                                fontSize: "11px",
                                color: "#a8a1b5",
                                lineHeight: "1.4",
                              }}
                            >
                              <span>500m: {density.within500m ?? 0}</span>
                              <span>1km: {density.within1km ?? 0}</span>
                              <span>3km: {density.within3km ?? 0}</span>
                            </div>
                          )}
                        </div>

                        {/* TOTAL COMPETITORS */}
                        <div className="local-analysis-item">
                          <div className="local-analysis-heading">
                            <span>
                              Nearby Competitors
                            </span>

                            <span className="local-analysis-icon">
                              ◉
                            </span>
                          </div>

                          <div className="local-analysis-score">
                            {idea.analysis?.competition
                              ?.totalCompetitors ??
                              idea.analysis
                                ?.totalCompetitors ??
                              idea.competitorCount ??
                              "--"}
                          </div>

                          <div className="local-analysis-caption">
                            businesses found
                          </div>
                        </div>

                      </div>
                    )}

                    {/* STATUS */}
                    <div className="my-idea-status">

                      <span
                        className={
                          isAnalyzed
                            ? "status-complete"
                            : "status-pending"
                        }
                      >
                        <span className="status-dot" />

                        {isAgent
                          ? isAnalyzed
                            ? `Verdict: ${idea.analysis?.verdict || "Complete"}`
                            : idea.agentState
                            ? `Agent: ${idea.agentState.replace(/_/g, " ")}`
                            : "Investigation Pending"
                          : isAnalyzed
                          ? "Analysis complete"
                          : "Not analyzed"}
                      </span>

                      {isAnalyzed &&
                        overallScore !== null && (
                          <span className="status-score-label">
                            Overall{" "}
                            <strong>
                              {overallScore}
                            </strong>
                          </span>
                        )}

                      {isAgent &&
                        isAnalyzed &&
                        idea.analysis?.verdict && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: "11px",
                              fontWeight: "700",
                              color:
                                idea.analysis.verdict === "VIABLE"
                                  ? "#10b981"
                                  : idea.analysis.verdict === "HIGH_RISK"
                                  ? "#ef4444"
                                  : "#f59e0b",
                            }}
                          >
                            {idea.analysis.verdict}
                          </span>
                        )}
                    </div>

                    {/* ACTIONS */}
                    <div className="my-idea-actions">

                      {isAgent && !isAnalyzed ? (
                        <Link
                          to={`/agent?runId=${idea._id}`}
                          className="my-idea-view-button"
                        >
                          {idea.agentState === "executing"
                            ? "View Live Progress"
                            : idea.agentState === "awaiting_approval"
                            ? "Review Plan"
                            : idea.agentState === "awaiting_clarification"
                            ? "Answer Agent"
                            : "Open in Studio"}
                          <span>→</span>
                        </Link>
                      ) : (
                        <Link
                          to={`/analysis/${idea._id}`}
                          className="my-idea-view-button"
                        >
                          {isAnalyzed
                            ? "View Analysis"
                            : "Analyze Idea"}
                          <span>→</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        className="my-idea-delete-button"
                        onClick={() =>
                          handleDelete(idea._id)
                        }
                        disabled={
                          deletingId === idea._id
                        }
                      >
                        {deletingId === idea._id
                          ? "Deleting..."
                          : "Delete"}
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MyIdeas;