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
            to="/analyze"
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
              to="/analyze"
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
                 *
                 * Local analysis can store it in either:
                 *
                 * idea.analysis.competition.score
                 *
                 * or
                 *
                 * idea.analysis.competitionScore
                 *
                 * We support both so the UI remains compatible
                 * with your existing backend.
                 */
                const competitionScore = isLocal
                  ? (
                    idea.analysis?.competition?.score ??
                    idea.analysis?.competitionScore ??
                    null
                  )
                  : null;

                const competitionLevel = isLocal
                  ? (
                    idea.analysis?.competition?.level ??
                    null
                  )
                  : null;

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
                        <span className="my-idea-category">
                          {idea.category || "General"}
                        </span>

                        {isLocal && (
                          <span className="my-idea-local">
                            📍 Local
                          </span>
                        )}
                      </div>

                      {/* OVERALL SCORE */}
                      <div
                        className={`my-idea-score ${isAnalyzed ? "has-score" : "no-score"
                          }`}
                      >
                        <div className="score-number">
                          {overallScore ?? "--"}
                        </div>

                        <div className="score-total">
                          /100
                        </div>
                      </div>
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

                          <div className="local-analysis-score">
                            {competitionScore !==
                              null
                              ? `${competitionScore}/100`
                              : "--"}
                          </div>

                          {competitionLevel && (
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

                        {isAnalyzed
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
                    </div>

                    {/* ACTIONS */}
                    <div className="my-idea-actions">

                      <Link
                        to={`/analysis/${idea._id}`}
                        className="my-idea-view-button"
                      >
                        {isAnalyzed
                          ? "View Analysis"
                          : "Analyze Idea"}

                        <span>→</span>
                      </Link>

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