import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function CompareIdeas() {
  const token = localStorage.getItem("token");

  const [ideas, setIdeas] = useState([]);
  const [ideaOneId, setIdeaOneId] = useState(null);
  const [ideaTwoId, setIdeaTwoId] = useState(null);

  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(
    token ? "" : "You must be logged in to compare ideas."
  );

  // =====================================================
  // FETCH REAL IDEAS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    const fetchIdeas = async () => {
      try {
        const response = await axios.get(`${API_URL}/ideas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) return;

        const fetchedIdeas = response.data?.ideas || [];

        setIdeas(fetchedIdeas);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to fetch ideas:", err);

        setError(
          err.response?.data?.message ||
            "Failed to load your ideas."
        );

        setLoading(false);
      }
    };

    fetchIdeas();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // =====================================================
  // DEFAULT IDEA IDS
  // =====================================================

  const firstIdeaId =
    ideaOneId ||
    ideas[0]?._id?.toString() ||
    "";

  const secondIdeaId =
    ideaTwoId &&
    ideaTwoId !== firstIdeaId
      ? ideaTwoId
      : ideas.find(
          (idea) =>
            idea._id?.toString() !== firstIdeaId
        )?._id?.toString() || "";

  // =====================================================
  // SELECTED IDEAS
  // =====================================================

  const ideaOne = useMemo(() => {
    return ideas.find(
      (idea) =>
        idea._id?.toString() === firstIdeaId
    );
  }, [ideas, firstIdeaId]);

  const ideaTwo = useMemo(() => {
    return ideas.find(
      (idea) =>
        idea._id?.toString() === secondIdeaId
    );
  }, [ideas, secondIdeaId]);

  // =====================================================
  // GET SCORE
  // =====================================================

  const getScore = (idea, key) => {
    if (!idea?.analysis) {
      return null;
    }

    // ---------------------------------------------------
    // TECH / NORMAL PROJECT
    // ---------------------------------------------------

    if (idea.analysisMode !== "local") {
      const score = idea.analysis?.scores?.[key];

      return Number.isFinite(Number(score))
        ? Number(score)
        : null;
    }

    // ---------------------------------------------------
    // LOCAL BUSINESS
    // ---------------------------------------------------

    if (key === "competition") {
      const score =
        idea.analysis?.competitionScore ??
        idea.analysis?.competition?.score;

      return Number.isFinite(Number(score))
        ? Number(score)
        : null;
    }

    return null;
  };

  // =====================================================
  // OVERALL SCORE
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
  // COMPARISON ROWS
  // =====================================================

  const comparisonRows = [
    {
      key: "demand",
      label: "Market Demand",
      description:
        "Potential customer demand for the idea.",
      icon: "◈",
    },
    {
      key: "competition",
      label: "Competition",
      description:
        "How competitive the current market is.",
      icon: "⚔",
    },
    {
      key: "development",
      label: "Development Ease",
      description:
        "How easy the idea is to build.",
      icon: "◇",
    },
    {
      key: "monetization",
      label: "Monetization",
      description:
        "Potential to generate revenue.",
      icon: "$",
    },
    {
      key: "seo",
      label: "SEO Opportunity",
      description:
        "Potential to attract organic search traffic.",
      icon: "⌕",
    },
  ];

  // =====================================================
  // WINNER
  // =====================================================

  const getWinner = (scoreOne, scoreTwo) => {
    if (
      scoreOne === null ||
      scoreTwo === null
    ) {
      return "none";
    }

    if (scoreOne === scoreTwo) {
      return "tie";
    }

    return scoreOne > scoreTwo
      ? "one"
      : "two";
  };

  const overallOne = getOverallScore(ideaOne);
  const overallTwo = getOverallScore(ideaTwo);

  const overallWinner = getWinner(
    overallOne,
    overallTwo
  );

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <>
        <style>{responsiveStyles}</style>

        <div style={styles.page}>
          <div style={styles.loadingContainer}>
            <div style={styles.loadingIcon}>✦</div>

            <h2 style={styles.loadingTitle}>
              Loading your ideas...
            </h2>

            <p style={styles.loadingText}>
              Getting your saved ideas from the
              database.
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
            <div style={styles.errorIcon}>!</div>

            <div style={styles.resultsLabel}>
              ERROR
            </div>

            <h2 style={styles.errorTitle}>
              Something went wrong
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
  // NOT ENOUGH IDEAS
  // =====================================================

  if (ideas.length < 2) {
    return (
      <>
        <style>{responsiveStyles}</style>

        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.header}>
              <div style={styles.resultsLabel}>
                IDEA COMPARISON
              </div>

              <h1 style={styles.title}>
                Compare Your Ideas
              </h1>

              <p style={styles.subtitle}>
                Compare two ideas side by side and
                discover which opportunity has the
                strongest potential.
              </p>
            </div>

            <div style={styles.emptyCard}>
              <div style={styles.emptyIcon}>
                ⚖
              </div>

              <h2 style={styles.emptyTitle}>
                You need at least two ideas
              </h2>

              <p style={styles.emptyText}>
                Create and save at least two ideas
                before using the comparison tool.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <>
      <style>{responsiveStyles}</style>

      <div style={styles.page}>
        <div style={styles.container}>

          {/* =================================================
              HEADER
          ================================================= */}

          <div style={styles.header}>
            <div style={styles.resultsLabel}>
              IDEA COMPARISON
            </div>

            <h1 style={styles.title}>
              Compare Your Ideas
            </h1>

            <p style={styles.subtitle}>
              Compare two analyzed ideas side by
              side and discover which opportunity
              has the strongest potential.
            </p>
          </div>

          {/* =================================================
              SELECTOR
          ================================================= */}

          <section
            style={styles.selectorCard}
            className="compare-selector"
          >
            <div style={styles.selector}>
              <label
                htmlFor="idea-one"
                style={styles.label}
              >
                First Idea
              </label>

              <select
                id="idea-one"
                value={firstIdeaId}
                onChange={(event) =>
                  setIdeaOneId(event.target.value)
                }
                style={styles.select}
              >
                {ideas.map((idea) => (
                  <option
                    key={idea._id}
                    value={idea._id}
                  >
                    {idea.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.vs}>
              VS
            </div>

            <div style={styles.selector}>
              <label
                htmlFor="idea-two"
                style={styles.label}
              >
                Second Idea
              </label>

              <select
                id="idea-two"
                value={secondIdeaId}
                onChange={(event) =>
                  setIdeaTwoId(event.target.value)
                }
                style={styles.select}
              >
                {ideas.map((idea) => (
                  <option
                    key={idea._id}
                    value={idea._id}
                    disabled={
                      idea._id?.toString() ===
                      firstIdeaId
                    }
                  >
                    {idea.title}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* =================================================
              IDEA HEADERS
          ================================================= */}

          {ideaOne && ideaTwo && (
            <>
              <section
                style={styles.ideaHeader}
                className="compare-idea-header"
              >

                {/* FIRST IDEA */}

                <div style={styles.ideaSummary}>
                  <div>
                    <span style={styles.category}>
                      {ideaOne.category || "General"}
                    </span>

                    {ideaOne.analysisMode ===
                      "local" && (
                      <span style={styles.localBadge}>
                        ● LOCAL
                      </span>
                    )}
                  </div>

                  <h2 style={styles.ideaTitle}>
                    {ideaOne.title}
                  </h2>

                  <div style={styles.scoreHeading}>
                    <span style={styles.scoreNumber}>
                      {overallOne !== null
                        ? overallOne
                        : "—"}
                    </span>

                    <span style={styles.scoreMax}>
                      /100
                    </span>
                  </div>

                  <div style={styles.scoreCaption}>
                    OVERALL OPPORTUNITY
                  </div>

                  {!ideaOne.analysis && (
                    <div style={styles.notAnalyzed}>
                      Not analyzed yet
                    </div>
                  )}
                </div>

                {/* VS CENTER */}

                <div
                  style={styles.overallLabel}
                  className="compare-vs-center"
                >
                  <div style={styles.vsCircle}>
                    VS
                  </div>

                  <span>COMPARE</span>
                </div>

                {/* SECOND IDEA */}

                <div
                  style={{
                    ...styles.ideaSummary,
                    ...styles.ideaSummaryRight,
                  }}
                >
                  <div>
                    <span style={styles.category}>
                      {ideaTwo.category || "General"}
                    </span>

                    {ideaTwo.analysisMode ===
                      "local" && (
                      <span style={styles.localBadge}>
                        ● LOCAL
                      </span>
                    )}
                  </div>

                  <h2 style={styles.ideaTitle}>
                    {ideaTwo.title}
                  </h2>

                  <div style={styles.scoreHeading}>
                    <span style={styles.scoreNumber}>
                      {overallTwo !== null
                        ? overallTwo
                        : "—"}
                    </span>

                    <span style={styles.scoreMax}>
                      /100
                    </span>
                  </div>

                  <div style={styles.scoreCaption}>
                    OVERALL OPPORTUNITY
                  </div>

                  {!ideaTwo.analysis && (
                    <div style={styles.notAnalyzed}>
                      Not analyzed yet
                    </div>
                  )}
                </div>
              </section>

              {/* =================================================
                  SCORE COMPARISON
              ================================================= */}

              <section style={styles.comparisonCard}>

                <div style={styles.comparisonHeader}>
                  <div>
                    <div style={styles.resultsLabel}>
                      PERFORMANCE
                    </div>

                    <h2 style={styles.comparisonTitle}>
                      Score Comparison
                    </h2>

                    <p style={styles.comparisonSubtitle}>
                      Compare the key factors affecting
                      each idea.
                    </p>
                  </div>
                </div>

                {comparisonRows.map((row) => {
                  const scoreOne = getScore(
                    ideaOne,
                    row.key
                  );

                  const scoreTwo = getScore(
                    ideaTwo,
                    row.key
                  );

                  const winner = getWinner(
                    scoreOne,
                    scoreTwo
                  );

                  return (
                    <div
                      style={styles.comparisonRow}
                      className="comparison-row"
                      key={row.key}
                    >

                      {/* FIRST SCORE */}

                      <div
                        style={{
                          ...styles.scoreBox,
                          ...(winner === "one"
                            ? styles.winnerBox
                            : {}),
                        }}
                      >
                        <span style={styles.metricIcon}>
                          {row.icon}
                        </span>

                        <strong
                          style={styles.scoreValue}
                        >
                          {scoreOne !== null
                            ? scoreOne
                            : "—"}
                        </strong>

                        {winner === "one" && (
                          <span
                            style={styles.winnerBadge}
                          >
                            WINNER
                          </span>
                        )}
                      </div>

                      {/* CENTER METRIC */}

                      <div style={styles.metric}>
                        <div
                          style={
                            styles.metricTop
                          }
                        >
                          <p
                            style={
                              styles.metricLabel
                            }
                          >
                            {row.label}
                          </p>
                        </div>

                        <p
                          style={
                            styles.metricDescription
                          }
                        >
                          {row.description}
                        </p>

                        <div style={styles.bars}>

                          <div
                            style={
                              styles.barTrack
                            }
                          >
                            <div
                              style={{
                                ...styles.bar,
                                width:
                                  scoreOne !== null
                                    ? `${scoreOne}%`
                                    : "0%",
                              }}
                            />
                          </div>

                          <div
                            style={
                              styles.barTrack
                            }
                          >
                            <div
                              style={{
                                ...styles.bar,
                                width:
                                  scoreTwo !== null
                                    ? `${scoreTwo}%`
                                    : "0%",
                              }}
                            />
                          </div>

                        </div>
                      </div>

                      {/* SECOND SCORE */}

                      <div
                        style={{
                          ...styles.scoreBox,
                          ...(winner === "two"
                            ? styles.winnerBox
                            : {}),
                        }}
                      >
                        <span style={styles.metricIcon}>
                          {row.icon}
                        </span>

                        <strong
                          style={styles.scoreValue}
                        >
                          {scoreTwo !== null
                            ? scoreTwo
                            : "—"}
                        </strong>

                        {winner === "two" && (
                          <span
                            style={styles.winnerBadge}
                          >
                            WINNER
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* =================================================
                  LOCAL NOTICE
              ================================================= */}

              {(ideaOne.analysisMode === "local" ||
                ideaTwo.analysisMode === "local") && (
                <div
                  style={styles.noticeCard}
                  className="compare-notice"
                >
                  <div style={styles.noticeIcon}>
                    !
                  </div>

                  <div>
                    <h3 style={styles.noticeTitle}>
                      Analysis types differ
                    </h3>

                    <p style={styles.noticeText}>
                      Local business analyses currently
                      provide competition data while
                      normal project analyses provide
                      demand, development, monetization,
                      and SEO scores. Metrics that are
                      not available are shown as "—".
                    </p>
                  </div>
                </div>
              )}

              {/* =================================================
                  OVERALL RESULT
              ================================================= */}

              <section
                style={{
                  ...styles.resultCard,
                  ...(overallWinner === "tie"
                    ? styles.tieCard
                    : {}),
                }}
                className="compare-result"
              >
                <div style={styles.resultIcon}>
                  {overallWinner === "none"
                    ? "?"
                    : overallWinner === "tie"
                    ? "="
                    : "✦"}
                </div>

                <div style={styles.resultContent}>
                  <div style={styles.resultsLabel}>
                    OVERALL RESULT
                  </div>

                  {overallWinner === "tie" ? (
                    <>
                      <h2 style={styles.resultTitle}>
                        It's a Tie
                      </h2>

                      <p style={styles.resultText}>
                        Both ideas currently have
                        the same overall opportunity
                        score.
                      </p>
                    </>
                  ) : overallWinner === "none" ? (
                    <>
                      <h2 style={styles.resultTitle}>
                        Analysis Required
                      </h2>

                      <p style={styles.resultText}>
                        Analyze both ideas first to
                        determine which opportunity
                        has the stronger overall score.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 style={styles.resultTitle}>
                        {overallWinner === "one"
                          ? ideaOne.title
                          : ideaTwo.title}{" "}
                        wins
                      </h2>

                      <p style={styles.resultText}>
                        Based on the current overall
                        analysis score, this idea has
                        the stronger opportunity.
                      </p>
                    </>
                  )}
                </div>
              </section>

              {/* =================================================
                  AI INSIGHT
              ================================================= */}

              <section style={styles.insightCard}>
                <div style={styles.resultsLabel}>
                  AI INSIGHT
                </div>

                <h2 style={styles.insightTitle}>
                  What does this comparison mean?
                </h2>

                <p style={styles.insightText}>
                  A higher score can indicate stronger
                  market potential, but the best idea is
                  not always the one with the highest
                  score. Consider your skills, budget,
                  available time, target audience, and
                  long-term interest before deciding
                  which project to pursue.
                </p>
              </section>
            </>
          )}
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

  select option {
    background: #101014;
    color: #ffffff;
  }

  .compare-selector {
    grid-template-columns: minmax(0, 1fr) 70px minmax(0, 1fr);
  }

  .compare-idea-header {
    grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr);
  }

  .comparison-row {
    grid-template-columns: 105px minmax(0, 1fr) 105px;
  }

  @media (max-width: 800px) {
    .compare-selector {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .compare-selector .vs {
      order: 2;
    }

    .compare-selector .selector:first-child {
      order: 1;
    }

    .compare-selector .selector:last-child {
      order: 3;
    }

    .compare-idea-header {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .compare-vs-center {
      order: 2;
      padding: 4px 0;
    }

    .compare-vs-center + .idea-summary {
      order: 3;
    }

    .comparison-row {
      grid-template-columns: 80px minmax(0, 1fr) 80px;
      gap: 12px;
      padding: 22px 16px;
    }
  }

  @media (max-width: 560px) {
    .comparison-row {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .comparison-row .metric {
      grid-column: 1 / -1;
      grid-row: 1;
      order: -1;
    }

    .comparison-row .score-box {
      min-height: 90px;
    }

    .compare-notice {
      align-items: flex-start;
    }

    .compare-result {
      align-items: flex-start;
    }
  }

  @media (max-width: 420px) {
    .comparison-row {
      padding: 18px 12px;
    }

    .score-box {
      min-height: 80px !important;
    }
  }
`;

// =====================================================
// STYLES
// =====================================================

const styles = {
  // -----------------------------------------------------
  // PAGE
  // -----------------------------------------------------

  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -20%, rgba(124, 58, 237, 0.13), transparent 38%), #07070A",
    color: "#FFFFFF",
    padding: "44px 20px 90px",
    fontFamily:
      "Inter, Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },

  // -----------------------------------------------------
  // HEADER
  // -----------------------------------------------------

  header: {
    marginBottom: "30px",
  },

  resultsLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "2px",
    color: "#A78BFA",
    marginBottom: "10px",
    textTransform: "uppercase",
  },

  title: {
    margin: 0,
    fontSize: "clamp(32px, 5vw, 46px)",
    lineHeight: "1.1",
    fontWeight: "800",
    letterSpacing: "-1.5px",
    color: "#FFFFFF",
  },

  subtitle: {
    margin:
      "13px 0 0",
    maxWidth: "700px",
    fontSize: "15px",
    lineHeight: "1.7",
    color: "#92929B",
  },

  // -----------------------------------------------------
  // SELECTOR
  // -----------------------------------------------------

  selectorCard: {
    display: "grid",
    alignItems: "end",
    gap: "18px",
    padding: "22px",
    marginBottom: "22px",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #151518, #111114)",
    border:
      "1px solid #26262C",
    boxShadow:
      "0 20px 50px rgba(0, 0, 0, 0.25)",
  },

  selector: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#D6D6DC",
    marginBottom: "8px",
  },

  select: {
    width: "100%",
    minWidth: 0,
    padding: "13px 14px",
    borderRadius: "10px",
    border:
      "1px solid #29292F",
    background: "#09090C",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "600",
    outline: "none",
    cursor: "pointer",
  },

  vs: {
    height: "42px",
    width: "42px",
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "900",
    margin: "0 auto",
    boxShadow:
      "0 0 25px rgba(139, 92, 246, 0.25)",
  },

  // -----------------------------------------------------
  // IDEA HEADER
  // -----------------------------------------------------

  ideaHeader: {
    display: "grid",
    gap: "18px",
    alignItems: "stretch",
    marginBottom: "22px",
  },

  ideaSummary: {
    minWidth: 0,
    padding: "27px",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #16161A, #111114)",
    border:
      "1px solid #28282F",
    boxShadow:
      "0 20px 50px rgba(0, 0, 0, 0.25)",
  },

  ideaSummaryRight: {
    textAlign: "right",
  },

  category: {
    display: "inline-block",
    padding:
      "5px 10px",
    borderRadius: "6px",
    background:
      "rgba(124, 58, 237, 0.14)",
    border:
      "1px solid rgba(139, 92, 246, 0.22)",
    color: "#B69CFF",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    marginRight: "7px",
    textTransform: "uppercase",
  },

  localBadge: {
    display: "inline-block",
    padding:
      "5px 9px",
    borderRadius: "6px",
    background:
      "rgba(34, 197, 94, 0.08)",
    border:
      "1px solid rgba(34, 197, 94, 0.18)",
    color: "#86EFAC",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "0.6px",
  },

  ideaTitle: {
    margin:
      "18px 0 18px",
    fontSize: "clamp(19px, 3vw, 25px)",
    lineHeight: "1.3",
    color: "#FFFFFF",
    overflowWrap: "anywhere",
  },

  scoreHeading: {
    display: "flex",
    alignItems: "baseline",
    gap: "3px",
  },

  scoreNumber: {
    fontSize: "clamp(42px, 6vw, 56px)",
    lineHeight: "1",
    fontWeight: "900",
    color: "#A78BFA",
    letterSpacing: "-2px",
    textShadow:
      "0 0 30px rgba(167, 139, 250, 0.18)",
  },

  scoreMax: {
    fontSize: "15px",
    color: "#686870",
    fontWeight: "700",
  },

  scoreCaption: {
    marginTop: "7px",
    fontSize: "9px",
    letterSpacing: "1.5px",
    fontWeight: "800",
    color: "#66666F",
  },

  overallLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "8px",
    color: "#65656D",
    fontSize: "9px",
    letterSpacing: "1.5px",
    fontWeight: "800",
  },

  vsCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(124, 58, 237, 0.1)",
    border:
      "1px solid rgba(139, 92, 246, 0.35)",
    color: "#A78BFA",
    fontSize: "10px",
    fontWeight: "900",
    boxShadow:
      "0 0 25px rgba(124, 58, 237, 0.12)",
  },

  notAnalyzed: {
    display: "inline-block",
    marginTop: "13px",
    padding:
      "6px 9px",
    borderRadius: "6px",
    background:
      "rgba(234, 179, 8, 0.08)",
    border:
      "1px solid rgba(234, 179, 8, 0.16)",
    color: "#FDE68A",
    fontSize: "10px",
    fontWeight: "700",
  },

  // -----------------------------------------------------
  // COMPARISON CARD
  // -----------------------------------------------------

  comparisonCard: {
    background:
      "linear-gradient(145deg, #141417, #101013)",
    border:
      "1px solid #27272D",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow:
      "0 20px 55px rgba(0, 0, 0, 0.28)",
  },

  comparisonHeader: {
    padding:
      "25px 27px",
    borderBottom:
      "1px solid #24242A",
    background:
      "rgba(255, 255, 255, 0.01)",
  },

  comparisonTitle: {
    margin: 0,
    fontSize: "21px",
    color: "#FFFFFF",
    fontWeight: "800",
  },

  comparisonSubtitle: {
    margin:
      "7px 0 0",
    color: "#777780",
    fontSize: "13px",
  },

  // -----------------------------------------------------
  // COMPARISON ROW
  // -----------------------------------------------------

  comparisonRow: {
    display: "grid",
    gap: "22px",
    alignItems: "center",
    padding:
      "24px 26px",
    borderBottom:
      "1px solid #202025",
  },

  scoreBox: {
    minHeight: "88px",
    borderRadius: "12px",
    background: "#0C0C10",
    border:
      "1px solid #28282F",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "3px",
    transition:
      "all 0.25s ease",
  },

  winnerBox: {
    background:
      "linear-gradient(145deg, rgba(124, 58, 237, 0.17), rgba(79, 70, 229, 0.08))",
    border:
      "1px solid rgba(139, 92, 246, 0.55)",
    boxShadow:
      "0 0 25px rgba(124, 58, 237, 0.12)",
  },

  metricIcon: {
    fontSize: "11px",
    color: "#8B5CF6",
    marginBottom: "1px",
  },

  scoreValue: {
    fontSize: "27px",
    color: "#FFFFFF",
    fontWeight: "900",
  },

  winnerBadge: {
    fontSize: "8px",
    letterSpacing: "1.2px",
    fontWeight: "900",
    color: "#A78BFA",
  },

  // -----------------------------------------------------
  // METRIC
  // -----------------------------------------------------

  metric: {
    minWidth: 0,
  },

  metricTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  metricLabel: {
    margin: 0,
    textAlign: "center",
    fontSize: "15px",
    fontWeight: "800",
    color: "#E8E8EC",
  },

  metricDescription: {
    margin:
      "6px auto 15px",
    maxWidth: "500px",
    textAlign: "center",
    fontSize: "11px",
    lineHeight: "1.5",
    color: "#707078",
  },

  bars: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "8px",
  },

  barTrack: {
    height: "6px",
    borderRadius: "999px",
    background: "#25252B",
    overflow: "hidden",
  },

  bar: {
    height: "100%",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, #7C3AED, #9333EA)",
    transition:
      "width 0.4s ease",
  },

  // -----------------------------------------------------
  // NOTICE
  // -----------------------------------------------------

  noticeCard: {
    display: "flex",
    gap: "14px",
    marginTop: "20px",
    padding: "18px 20px",
    borderRadius: "14px",
    background:
      "rgba(124, 58, 237, 0.055)",
    border:
      "1px solid rgba(139, 92, 246, 0.2)",
  },

  noticeIcon: {
    width: "27px",
    height: "27px",
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(139, 92, 246, 0.15)",
    color: "#A78BFA",
    fontSize: "13px",
    fontWeight: "900",
  },

  noticeTitle: {
    margin:
      "1px 0 5px",
    fontSize: "14px",
    color: "#D8CCFF",
  },

  noticeText: {
    margin: 0,
    lineHeight: "1.6",
    fontSize: "12px",
    color: "#8B8798",
  },

  // -----------------------------------------------------
  // RESULT
  // -----------------------------------------------------

  resultCard: {
    display: "flex",
    alignItems: "center",
    gap: "19px",
    marginTop: "20px",
    padding: "25px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(79, 70, 229, 0.06))",
    border:
      "1px solid rgba(139, 92, 246, 0.3)",
    boxShadow:
      "0 15px 45px rgba(0, 0, 0, 0.25)",
  },

  tieCard: {
    background:
      "linear-gradient(135deg, rgba(99, 102, 241, 0.09), rgba(124, 58, 237, 0.04))",
  },

  resultIcon: {
    width: "58px",
    height: "58px",
    borderRadius: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "25px",
    fontWeight: "900",
    color: "#FFFFFF",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    boxShadow:
      "0 0 30px rgba(139, 92, 246, 0.25)",
    flexShrink: 0,
  },

  resultContent: {
    minWidth: 0,
  },

  resultTitle: {
    margin:
      "3px 0 7px",
    fontSize: "22px",
    lineHeight: "1.3",
    color: "#FFFFFF",
    overflowWrap: "anywhere",
  },

  resultText: {
    margin: 0,
    color: "#9999A2",
    lineHeight: "1.6",
    fontSize: "13px",
  },

  // -----------------------------------------------------
  // INSIGHT
  // -----------------------------------------------------

  insightCard: {
    marginTop: "20px",
    padding: "27px",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #141417, #101013)",
    border:
      "1px solid #27272D",
    boxShadow:
      "0 15px 40px rgba(0, 0, 0, 0.2)",
  },

  insightTitle: {
    margin:
      "4px 0 11px",
    fontSize: "21px",
    color: "#FFFFFF",
    fontWeight: "800",
  },

  insightText: {
    margin: 0,
    maxWidth: "850px",
    lineHeight: "1.75",
    color: "#85858E",
    fontSize: "13px",
  },

  // -----------------------------------------------------
  // LOADING
  // -----------------------------------------------------

  loadingContainer: {
    maxWidth: "560px",
    margin: "110px auto",
    textAlign: "center",
    padding: "48px 30px",
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
    fontSize: "28px",
    color: "#FFFFFF",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
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

  // -----------------------------------------------------
  // ERROR
  // -----------------------------------------------------

  errorContainer: {
    maxWidth: "560px",
    margin: "110px auto",
    textAlign: "center",
    padding: "48px 30px",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid rgba(248, 113, 113, 0.25)",
    boxShadow:
      "0 20px 60px rgba(0, 0, 0, 0.3)",
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

  // -----------------------------------------------------
  // EMPTY
  // -----------------------------------------------------

  emptyCard: {
    maxWidth: "680px",
    margin: "55px auto",
    padding: "60px 30px",
    textAlign: "center",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, #151518, #101013)",
    border:
      "1px solid #28282E",
    boxShadow:
      "0 20px 55px rgba(0, 0, 0, 0.28)",
  },

  emptyIcon: {
    width: "65px",
    height: "65px",
    margin: "0 auto 20px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "29px",
    color: "#FFFFFF",
    background:
      "linear-gradient(135deg, #7C3AED, #9333EA)",
    boxShadow:
      "0 0 35px rgba(139, 92, 246, 0.22)",
  },

  emptyTitle: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "22px",
  },

  emptyText: {
    maxWidth: "500px",
    margin:
      "11px auto 0",
    lineHeight: "1.7",
    color: "#85858E",
    fontSize: "13px",
  },
};

export default CompareIdeas;