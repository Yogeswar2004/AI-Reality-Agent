import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

function Dashboard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // FETCH IDEAS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const fetchIdeas = async () => {
      try {
        const response = await api.get("/ideas");

        if (cancelled) return;

        setIdeas(response.data?.ideas || []);
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Fetch dashboard ideas error:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Failed to load your ideas"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchIdeas();

    return () => {
      cancelled = true;
    };
  }, []);

  // =====================================================
  // GET OVERALL SCORE
  // =====================================================

  const getOverallScore = (idea) => {
    if (!idea?.analysis) {
      return null;
    }

    const score =
      idea.analysis?.overallScore ??
      idea.analysis?.opportunityScore;

    return Number.isFinite(Number(score))
      ? Number(score)
      : null;
  };

  // =====================================================
  // DASHBOARD STATS
  // =====================================================

  const stats = useMemo(() => {
    const analyzedIdeas = ideas.filter(
      (idea) => getOverallScore(idea) !== null
    );

    const totalIdeas = ideas.length;

    const averageScore =
      analyzedIdeas.length > 0
        ? Math.round(
            analyzedIdeas.reduce(
              (total, idea) =>
                total + getOverallScore(idea),
              0
            ) / analyzedIdeas.length
          )
        : 0;

    const bestIdea =
      analyzedIdeas.length > 0
        ? analyzedIdeas.reduce((best, idea) => {
            return getOverallScore(idea) >
              getOverallScore(best)
              ? idea
              : best;
          })
        : null;

    return {
      totalIdeas,
      analyzedIdeas: analyzedIdeas.length,
      averageScore,
      bestIdea,
    };
  }, [ideas]);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <>
        <style>{responsiveStyles}</style>

        <div style={styles.page}>
          <div style={styles.loadingContainer}>
            <div style={styles.loadingIcon}>
              ✦
            </div>

            <h2 style={styles.loadingTitle}>
              Loading your dashboard...
            </h2>

            <p style={styles.loadingText}>
              Getting your latest ideas and
              analysis results.
            </p>

            <div style={styles.loadingLine}>
              <div style={styles.loadingLineInner} />
            </div>
          </div>
        </div>
      </>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <>
        <style>{responsiveStyles}</style>

        <div style={styles.page}>
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>
              !
            </div>

            <div style={styles.resultsLabel}>
              DASHBOARD ERROR
            </div>

            <h2 style={styles.errorTitle}>
              Unable to load dashboard
            </h2>

            <p style={styles.errorText}>
              {error}
            </p>
          </div>
        </div>
      </>
    );
  }

  // =====================================================
  // MAIN DASHBOARD
  // =====================================================

  return (
    <>
      <style>{responsiveStyles}</style>

      <div style={styles.page}>
        <div style={styles.container}>

          {/* =================================================
              HEADER
          ================================================= */}

          <section
            style={styles.dashboardHeader}
            className="dashboard-header"
          >
            <div>
              <div style={styles.resultsLabel}>
                YOUR DASHBOARD
              </div>

              <h1 style={styles.title}>
                Your ideas, analyzed.
              </h1>

              <p style={styles.subtitle}>
                Track your startup ideas and discover
                which ones have the strongest potential.
              </p>
            </div>

            <Link
              to="/analyze"
              style={styles.analyzeButton}
              className="dashboard-analyze-button"
            >
              + Analyze New Idea
            </Link>
          </section>

          {/* =================================================
              STATS
          ================================================= */}

          <section
            style={styles.statsGrid}
            className="dashboard-stats"
          >
            {/* TOTAL IDEAS */}

            <div style={styles.statCard}>
              <div style={styles.statTop}>
                <span style={styles.statLabel}>
                  TOTAL IDEAS
                </span>

                <span style={styles.statIcon}>
                  ◇
                </span>
              </div>

              <h2 style={styles.statValue}>
                {stats.totalIdeas}
              </h2>

              <p style={styles.statDescription}>
                Ideas you've created
              </p>
            </div>

            {/* ANALYZED */}

            <div style={styles.statCard}>
              <div style={styles.statTop}>
                <span style={styles.statLabel}>
                  ANALYZED
                </span>

                <span style={styles.statIcon}>
                  ✦
                </span>
              </div>

              <h2 style={styles.statValue}>
                {stats.analyzedIdeas}
              </h2>

              <p style={styles.statDescription}>
                Ideas with analysis
              </p>
            </div>

            {/* AVERAGE */}

            <div style={styles.statCard}>
              <div style={styles.statTop}>
                <span style={styles.statLabel}>
                  AVERAGE SCORE
                </span>

                <span style={styles.statIcon}>
                  ◈
                </span>
              </div>

              <h2 style={styles.statValue}>
                {stats.averageScore}
                <span style={styles.statMax}>
                  /100
                </span>
              </h2>

              <p style={styles.statDescription}>
                Across analyzed ideas
              </p>
            </div>

            {/* BEST SCORE */}

            <div
              style={{
                ...styles.statCard,
                ...styles.highlightStatCard,
              }}
            >
              <div style={styles.statTop}>
                <span style={styles.statLabel}>
                  BEST SCORE
                </span>

                <span
                  style={styles.highlightStatIcon}
                >
                  ★
                </span>
              </div>

              <h2
                style={{
                  ...styles.statValue,
                  ...styles.highlightStatValue,
                }}
              >
                {stats.bestIdea
                  ? getOverallScore(
                      stats.bestIdea
                    )
                  : "--"}

                {stats.bestIdea && (
                  <span style={styles.statMax}>
                    /100
                  </span>
                )}
              </h2>

              <p style={styles.statDescription}>
                Your strongest opportunity
              </p>
            </div>
          </section>

          {/* =================================================
              RECENT IDEAS
          ================================================= */}

          <section style={styles.recentSection}>
            <div
              style={styles.sectionHeader}
              className="dashboard-section-header"
            >
              <div>
                <div style={styles.resultsLabel}>
                  YOUR WORK
                </div>

                <h2 style={styles.sectionTitle}>
                  Recent Ideas
                </h2>

                <p style={styles.sectionSubtitle}>
                  Your latest analyzed projects.
                </p>
              </div>

              {ideas.length > 0 && (
                <Link
                  to="/my-ideas"
                  style={styles.viewAll}
                >
                  View All →
                </Link>
              )}
            </div>

            {/* EMPTY STATE */}

            {ideas.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIcon}>
                  ✦
                </div>

                <h3 style={styles.emptyTitle}>
                  No ideas yet
                </h3>

                <p style={styles.emptyText}>
                  Start by analyzing your first
                  project idea and discover its
                  real-world potential.
                </p>

                <Link
                  to="/analyze"
                  style={styles.emptyButton}
                >
                  Analyze Your First Idea →
                </Link>
              </div>
            ) : (
              <div
                style={styles.ideasList}
                className="dashboard-ideas-list"
              >
                {ideas.slice(0, 5).map((idea) => {
                  const score =
                    getOverallScore(idea);

                  return (
                    <Link
                      to={`/analysis/${idea._id}`}
                      style={styles.ideaCard}
                      className="dashboard-idea-card"
                      key={idea._id}
                    >
                      {/* IDEA INFO */}

                      <div style={styles.ideaInfo}>
                        <div
                          style={
                            styles.ideaBadges
                          }
                        >
                          <span
                            style={
                              styles.categoryBadge
                            }
                          >
                            {idea.category ||
                              "General"}
                          </span>

                          {idea.analysisMode ===
                            "local" && (
                            <span
                              style={
                                styles.localBadge
                              }
                            >
                              ● LOCAL
                            </span>
                          )}

                          {idea.analysis && (
                            <span
                              style={
                                styles.analyzedBadge
                              }
                            >
                              ANALYZED
                            </span>
                          )}
                        </div>

                        <h3
                          style={
                            styles.ideaTitle
                          }
                        >
                          {idea.title}
                        </h3>

                        <p
                          style={
                            styles.ideaDescription
                          }
                        >
                          {idea.description?.length >
                          120
                            ? `${idea.description.slice(
                                0,
                                120
                              )}...`
                            : idea.description ||
                              "No description available."}
                        </p>
                      </div>

                      {/* SCORE */}

                      <div
                        style={
                          styles.ideaScoreContainer
                        }
                      >
                        <span
                          style={
                            styles.ideaScoreLabel
                          }
                        >
                          SCORE
                        </span>

                        <div
                          style={
                            styles.ideaScore
                          }
                        >
                          {score !== null
                            ? score
                            : "--"}
                        </div>

                        {score !== null && (
                          <span
                            style={
                              styles.ideaScoreMax
                            }
                          >
                            /100
                          </span>
                        )}
                      </div>

                      <div
                        style={
                          styles.ideaArrow
                        }
                      >
                        →
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* =================================================
              BEST IDEA
          ================================================= */}

          {stats.bestIdea && (
            <section
              style={styles.bestIdeaCard}
              className="dashboard-best-idea"
            >
              <div
                style={styles.bestIdeaGlow}
              />

              <div
                style={
                  styles.bestIdeaContent
                }
              >
                <div
                  style={
                    styles.resultsLabel
                  }
                >
                  YOUR STRONGEST IDEA
                </div>

                <h2
                  style={
                    styles.bestIdeaTitle
                  }
                >
                  {stats.bestIdea.title}
                </h2>

                <p
                  style={
                    styles.bestIdeaText
                  }
                >
                  Your highest-scoring analyzed
                  idea currently has an overall
                  opportunity score of{" "}
                  <strong
                    style={
                      styles.bestIdeaScoreInline
                    }
                  >
                    {getOverallScore(
                      stats.bestIdea
                    )}
                    /100
                  </strong>
                  .
                </p>

                <Link
                  to={`/analysis/${stats.bestIdea._id}`}
                  style={
                    styles.bestIdeaButton
                  }
                >
                  View Full Analysis →
                </Link>
              </div>

              <div
                style={
                  styles.bestScoreCircle
                }
              >
                <span
                  style={
                    styles.bestScoreNumber
                  }
                >
                  {getOverallScore(
                    stats.bestIdea
                  )}
                </span>

                <span
                  style={
                    styles.bestScoreMax
                  }
                >
                  /100
                </span>
              </div>
            </section>
          )}

          {/* =================================================
              QUICK ACTIONS
          ================================================= */}

          <section
            style={styles.quickActions}
            className="dashboard-quick-actions"
          >
            <div>
              <div style={styles.resultsLabel}>
                QUICK ACTIONS
              </div>

              <h2 style={styles.sectionTitle}>
                What would you like to do?
              </h2>
            </div>

            <div
              style={styles.actionGrid}
              className="dashboard-action-grid"
            >
              <Link
                to="/analyze"
                style={styles.actionCard}
              >
                <div style={styles.actionIcon}>
                  +
                </div>

                <div>
                  <h3 style={styles.actionTitle}>
                    Analyze New Idea
                  </h3>

                  <p
                    style={
                      styles.actionDescription
                    }
                  >
                    Test a new project or business
                    idea.
                  </p>
                </div>

                <span
                  style={styles.actionArrow}
                >
                  →
                </span>
              </Link>

              <Link
                to="/my-ideas"
                style={styles.actionCard}
              >
                <div style={styles.actionIcon}>
                  ◇
                </div>

                <div>
                  <h3 style={styles.actionTitle}>
                    View My Ideas
                  </h3>

                  <p
                    style={
                      styles.actionDescription
                    }
                  >
                    Review all your saved ideas.
                  </p>
                </div>

                <span
                  style={styles.actionArrow}
                >
                  →
                </span>
              </Link>

              <Link
                to="/compare"
                style={styles.actionCard}
              >
                <div style={styles.actionIcon}>
                  ⚖
                </div>

                <div>
                  <h3 style={styles.actionTitle}>
                    Compare Ideas
                  </h3>

                  <p
                    style={
                      styles.actionDescription
                    }
                  >
                    Find out which idea has
                    stronger potential.
                  </p>
                </div>

                <span
                  style={styles.actionArrow}
                >
                  →
                </span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// =====================================================
// RESPONSIVE CSS
// =====================================================

const responsiveStyles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #07070A;
  }

  .dashboard-analyze-button,
  .dashboard-idea-card,
  .dashboard-action-card {
    text-decoration: none;
  }

  .dashboard-analyze-button:hover {
    transform: translateY(-2px);
    box-shadow:
      0 12px 30px rgba(124, 58, 237, 0.28);
  }

  .dashboard-idea-card:hover {
    transform: translateY(-2px);
    border-color: rgba(139, 92, 246, 0.4) !important;
    background: #17171B !important;
  }

  .dashboard-action-card:hover {
    transform: translateY(-2px);
    border-color: rgba(139, 92, 246, 0.4) !important;
    background: #17171B !important;
  }

  .dashboard-analyze-button,
  .dashboard-idea-card,
  .dashboard-action-card {
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;
  }

  @media (max-width: 900px) {
    .dashboard-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .dashboard-header {
      align-items: flex-start !important;
    }

    .dashboard-action-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 700px) {
    .dashboard-header {
      flex-direction: column !important;
    }

    .dashboard-analyze-button {
      width: 100%;
      text-align: center;
    }

    .dashboard-section-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 15px !important;
    }

    .dashboard-best-idea {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .dashboard-idea-card {
      grid-template-columns: 1fr auto !important;
    }

    .dashboard-idea-card > .idea-info {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 560px) {
    .dashboard-stats {
      grid-template-columns: 1fr !important;
    }

    .dashboard-idea-card {
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }

    .dashboard-idea-score-container {
      text-align: left !important;
      align-items: flex-start !important;
    }

    .dashboard-idea-arrow {
      display: none !important;
    }

    .dashboard-best-idea {
      padding: 24px !important;
    }

    .dashboard-quick-actions {
      padding: 22px !important;
    }
  }
`;

// =====================================================
// STYLES
// =====================================================

const styles = {
  // =====================================================
  // PAGE
  // =====================================================

  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -20%, rgba(124, 58, 237, 0.13), transparent 38%), #07070A",
    color: "#FFFFFF",
    padding: "42px 20px 90px",
    fontFamily:
      "Inter, Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },

  // =====================================================
  // HEADER
  // =====================================================

  dashboardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "25px",
    marginBottom: "30px",
  },

  resultsLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "2px",
    color: "#A78BFA",
    marginBottom: "9px",
    textTransform: "uppercase",
  },

  title: {
    margin: 0,
    fontSize:
      "clamp(32px, 5vw, 45px)",
    lineHeight: "1.1",
    fontWeight: "800",
    letterSpacing: "-1.5px",
    color: "#FFFFFF",
  },

  subtitle: {
    margin:
      "12px 0 0",
    maxWidth: "680px",
    color: "#8F8F98",
    fontSize: "15px",
    lineHeight: "1.7",
  },

  analyzeButton: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding:
      "13px 20px",
    borderRadius: "9px",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: "800",
    boxShadow:
      "0 8px 25px rgba(124, 58, 237, 0.2)",
  },

  // =====================================================
  // STATS
  // =====================================================

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },

  statCard: {
    minWidth: 0,
    padding: "20px",
    borderRadius: "14px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid #27272D",
    boxShadow:
      "0 15px 40px rgba(0, 0, 0, 0.22)",
  },

  highlightStatCard: {
    background:
      "linear-gradient(145deg, rgba(124, 58, 237, 0.12), #121216)",
    border:
      "1px solid rgba(139, 92, 246, 0.3)",
  },

  statTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statLabel: {
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1.4px",
    color: "#777780",
  },

  statIcon: {
    color: "#8B5CF6",
    fontSize: "15px",
  },

  highlightStatIcon: {
    color: "#A78BFA",
    fontSize: "15px",
  },

  statValue: {
    margin:
      "18px 0 4px",
    fontSize: "31px",
    lineHeight: "1",
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: "-1px",
  },

  highlightStatValue: {
    color: "#B69CFF",
  },

  statMax: {
    marginLeft: "3px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#64646D",
    letterSpacing: "0",
  },

  statDescription: {
    margin: 0,
    color: "#676770",
    fontSize: "11px",
    lineHeight: "1.5",
  },

  // =====================================================
  // RECENT IDEAS
  // =====================================================

  recentSection: {
    marginTop: "10px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "16px",
  },

  sectionTitle: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "-0.4px",
  },

  sectionSubtitle: {
    margin:
      "6px 0 0",
    color: "#707078",
    fontSize: "12px",
  },

  viewAll: {
    color: "#A78BFA",
    fontSize: "12px",
    fontWeight: "700",
    textDecoration: "none",
  },

  // =====================================================
  // IDEAS LIST
  // =====================================================

  ideasList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  ideaCard: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) 100px 25px",
    alignItems: "center",
    gap: "20px",
    padding: "19px 21px",
    borderRadius: "13px",
    background:
      "linear-gradient(145deg, #141417, #101013)",
    border:
      "1px solid #27272D",
    boxShadow:
      "0 10px 30px rgba(0, 0, 0, 0.18)",
  },

  ideaInfo: {
    minWidth: 0,
  },

  ideaBadges: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "8px",
  },

  categoryBadge: {
    display: "inline-block",
    padding:
      "4px 8px",
    borderRadius: "5px",
    background:
      "rgba(124, 58, 237, 0.12)",
    border:
      "1px solid rgba(139, 92, 246, 0.2)",
    color: "#B69CFF",
    fontSize: "8px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },

  localBadge: {
    display: "inline-block",
    padding:
      "4px 8px",
    borderRadius: "5px",
    background:
      "rgba(34, 197, 94, 0.07)",
    border:
      "1px solid rgba(34, 197, 94, 0.15)",
    color: "#86EFAC",
    fontSize: "8px",
    fontWeight: "800",
    letterSpacing: "0.6px",
  },

  analyzedBadge: {
    display: "inline-block",
    padding:
      "4px 8px",
    borderRadius: "5px",
    background:
      "rgba(167, 139, 250, 0.07)",
    border:
      "1px solid rgba(167, 139, 250, 0.13)",
    color: "#9CA3AF",
    fontSize: "8px",
    fontWeight: "800",
    letterSpacing: "0.6px",
  },

  ideaTitle: {
    margin:
      "0 0 6px",
    color: "#F5F5F7",
    fontSize: "15px",
    lineHeight: "1.4",
    fontWeight: "800",
    overflowWrap: "anywhere",
  },

  ideaDescription: {
    margin: 0,
    color: "#717179",
    fontSize: "11px",
    lineHeight: "1.6",
  },

  ideaScoreContainer: {
    textAlign: "right",
    minWidth: 0,
  },

  ideaScoreLabel: {
    display: "block",
    marginBottom: "4px",
    color: "#5F5F67",
    fontSize: "8px",
    fontWeight: "800",
    letterSpacing: "1px",
  },

  ideaScore: {
    display: "inline",
    color: "#A78BFA",
    fontSize: "28px",
    fontWeight: "900",
    letterSpacing: "-1px",
  },

  ideaScoreMax: {
    marginLeft: "2px",
    color: "#5F5F67",
    fontSize: "10px",
    fontWeight: "700",
  },

  ideaArrow: {
    color: "#66666F",
    fontSize: "18px",
    textAlign: "right",
  },

  // =====================================================
  // EMPTY STATE
  // =====================================================

  emptyCard: {
    padding: "55px 25px",
    textAlign: "center",
    borderRadius: "15px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid #28282E",
    boxShadow:
      "0 20px 50px rgba(0, 0, 0, 0.25)",
  },

  emptyIcon: {
    width: "58px",
    height: "58px",
    margin: "0 auto 17px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    color: "#FFFFFF",
    fontSize: "25px",
    boxShadow:
      "0 0 30px rgba(124, 58, 237, 0.22)",
  },

  emptyTitle: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "20px",
  },

  emptyText: {
    maxWidth: "500px",
    margin:
      "9px auto 20px",
    color: "#7B7B84",
    fontSize: "12px",
    lineHeight: "1.7",
  },

  emptyButton: {
    display: "inline-flex",
    padding:
      "11px 17px",
    borderRadius: "8px",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: "800",
    textDecoration: "none",
  },

  // =====================================================
  // BEST IDEA
  // =====================================================

  bestIdeaCard: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "30px",
    marginTop: "22px",
    padding: "27px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(79, 70, 229, 0.055))",
    border:
      "1px solid rgba(139, 92, 246, 0.3)",
    boxShadow:
      "0 20px 55px rgba(0, 0, 0, 0.25)",
  },

  bestIdeaGlow: {
    position: "absolute",
    width: "220px",
    height: "220px",
    right: "-80px",
    top: "-100px",
    borderRadius: "50%",
    background:
      "rgba(139, 92, 246, 0.12)",
    filter: "blur(45px)",
    pointerEvents: "none",
  },

  bestIdeaContent: {
    position: "relative",
    minWidth: 0,
  },

  bestIdeaTitle: {
    margin:
      "4px 0 8px",
    color: "#FFFFFF",
    fontSize:
      "clamp(20px, 3vw, 27px)",
    lineHeight: "1.3",
    overflowWrap: "anywhere",
  },

  bestIdeaText: {
    maxWidth: "700px",
    margin:
      "0 0 18px",
    color: "#92929B",
    fontSize: "12px",
    lineHeight: "1.7",
  },

  bestIdeaScoreInline: {
    color: "#C4B5FD",
  },

  bestIdeaButton: {
    display: "inline-flex",
    padding:
      "10px 15px",
    borderRadius: "8px",
    background:
      "rgba(124, 58, 237, 0.13)",
    border:
      "1px solid rgba(139, 92, 246, 0.28)",
    color: "#B69CFF",
    fontSize: "11px",
    fontWeight: "800",
    textDecoration: "none",
  },

  bestScoreCircle: {
    position: "relative",
    width: "105px",
    height: "105px",
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background:
      "radial-gradient(circle, #19131F 48%, #101014 49%)",
    border:
      "2px solid rgba(139, 92, 246, 0.5)",
    boxShadow:
      "0 0 35px rgba(124, 58, 237, 0.18)",
  },

  bestScoreNumber: {
    color: "#B69CFF",
    fontSize: "30px",
    fontWeight: "900",
    lineHeight: "1",
  },

  bestScoreMax: {
    marginTop: "3px",
    color: "#66666F",
    fontSize: "9px",
    fontWeight: "700",
  },

  // =====================================================
  // QUICK ACTIONS
  // =====================================================

  quickActions: {
    marginTop: "30px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "15px",
  },

  actionCard: {
    display: "grid",
    gridTemplateColumns:
      "42px minmax(0, 1fr) 20px",
    alignItems: "center",
    gap: "13px",
    padding: "18px",
    borderRadius: "13px",
    background:
      "linear-gradient(145deg, #141417, #101013)",
    border:
      "1px solid #27272D",
    color: "#FFFFFF",
  },

  actionIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(124, 58, 237, 0.12)",
    border:
      "1px solid rgba(139, 92, 246, 0.2)",
    color: "#A78BFA",
    fontSize: "18px",
    fontWeight: "700",
  },

  actionTitle: {
    margin:
      "0 0 4px",
    color: "#E8E8EC",
    fontSize: "13px",
    fontWeight: "800",
  },

  actionDescription: {
    margin: 0,
    color: "#6F6F78",
    fontSize: "10px",
    lineHeight: "1.5",
  },

  actionArrow: {
    color: "#777780",
    fontSize: "16px",
    textAlign: "right",
  },

  // =====================================================
  // LOADING
  // =====================================================

  loadingContainer: {
    maxWidth: "560px",
    margin: "110px auto",
    padding: "48px 30px",
    textAlign: "center",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid #28282E",
    boxShadow:
      "0 20px 60px rgba(0, 0, 0, 0.3)",
  },

  loadingIcon: {
    width: "55px",
    height: "55px",
    margin: "0 auto 18px",
    borderRadius: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    color: "#FFFFFF",
    fontSize: "28px",
    boxShadow:
      "0 0 30px rgba(139, 92, 246, 0.25)",
  },

  loadingTitle: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "20px",
  },

  loadingText: {
    color: "#777780",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  loadingLine: {
    width: "150px",
    height: "3px",
    margin: "20px auto 0",
    borderRadius: "999px",
    background: "#27272D",
    overflow: "hidden",
  },

  loadingLineInner: {
    width: "55%",
    height: "100%",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, #7C3AED, #9333EA)",
  },

  // =====================================================
  // ERROR
  // =====================================================

  errorContainer: {
    maxWidth: "560px",
    margin: "110px auto",
    padding: "48px 30px",
    textAlign: "center",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid rgba(248, 113, 113, 0.25)",
  },

  errorIcon: {
    width: "52px",
    height: "52px",
    margin: "0 auto 18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(239, 68, 68, 0.1)",
    border:
      "1px solid rgba(248, 113, 113, 0.25)",
    color: "#F87171",
    fontSize: "22px",
    fontWeight: "900",
  },

  errorTitle: {
    margin:
      "5px 0 10px",
    color: "#FFFFFF",
    fontSize: "21px",
  },

  errorText: {
    margin: 0,
    color: "#A1A1AA",
    lineHeight: "1.6",
    fontSize: "13px",
  },
};

export default Dashboard;