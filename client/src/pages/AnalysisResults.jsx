import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
/* =====================================================
   MAIN PAGE
===================================================== */

const AnalysisResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  /* =====================================================
     FETCH IDEA
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const fetchIdea = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/ideas/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!cancelled) {
          setIdea(response.data.idea);
        }
      } catch (error) {
        console.error(
          "Failed to fetch idea:",
          error
        );

        if (!cancelled) {
          setError(
            error.response?.data?.message ||
              "Failed to load idea"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (id) {
      void fetchIdea();
    }

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  /* =====================================================
     ANALYZE IDEA
  ===================================================== */

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setError("");

      const response = await axios.post(
        `${API_URL}/ideas/${id}/analyze`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setIdea((currentIdea) => ({
        ...currentIdea,
        analysis: response.data.analysis,
      }));
    } catch (error) {
      console.error(
        "Failed to analyze idea:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to analyze idea"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingSpinner} />

          <h2 style={styles.loadingTitle}>
            Loading Analysis
          </h2>

          <p style={styles.loadingText}>
            Preparing your project analysis...
          </p>
        </div>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error && !idea) {
    return (
      <div style={styles.errorPage}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>
            !
          </div>

          <h2 style={styles.errorTitle}>
            Something went wrong
          </h2>

          <p style={styles.errorMessage}>
            {error}
          </p>

          <button
            style={styles.primaryButton}
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div style={styles.errorPage}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>
            ?
          </div>

          <h2 style={styles.errorTitle}>
            Idea Not Found
          </h2>

          <p style={styles.errorMessage}>
            We couldn't find the project you're
            looking for.
          </p>

          <button
            style={styles.primaryButton}
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const analysis = idea.analysis;

  const isLocal =
    idea.analysisMode === "local";

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button
              style={styles.backButton}
              onClick={() =>
                navigate("/dashboard")
              }
            >
              <span style={styles.backArrow}>
                ←
              </span>

              Dashboard
            </button>

            <div style={styles.headerBadge}>
              <span style={styles.headerBadgeDot} />

              {isLocal
                ? "LOCAL BUSINESS ANALYSIS"
                : "AI PROJECT ANALYSIS"}
            </div>

            <h1 style={styles.title}>
              {isLocal
                ? "Local Business Analysis"
                : "AI Project Analysis"}
            </h1>

            <p style={styles.subtitle}>
              {isLocal
                ? "AI-powered local market and competitor intelligence."
                : "Turn your project idea into actionable market intelligence."}
            </p>
          </div>

          <button
            style={{
              ...styles.analyzeButton,
              ...(analyzing
                ? styles.analyzeButtonDisabled
                : {}),
            }}
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            <span style={styles.buttonIcon}>
              {analyzing ? "◌" : "✦"}
            </span>

            {analyzing
              ? "Analyzing with AI..."
              : analysis
              ? "Analyze Again"
              : "Analyze Idea"}
          </button>
        </div>

        {/* =====================================================
            IDEA CARD
        ===================================================== */}

        <div style={styles.ideaCard}>
          <div style={styles.ideaCardTop}>
            <div style={styles.badgeGroup}>
              <span style={styles.category}>
                {idea.category || "General"}
              </span>

              {isLocal && (
                <span style={styles.localBadge}>
                  <span>●</span>
                  Local Business
                </span>
              )}
            </div>

            <span style={styles.ideaId}>
              ID: {id}
            </span>
          </div>

          <h2 style={styles.ideaTitle}>
            {idea.title}
          </h2>

          <p style={styles.description}>
            {idea.description}
          </p>

          {isLocal &&
            idea.businessType && (
              <div style={styles.businessInfo}>
                <span style={styles.businessInfoLabel}>
                  BUSINESS TYPE
                </span>

                <span style={styles.businessInfoValue}>
                  {idea.businessType}
                </span>
              </div>
            )}
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div style={styles.error}>
            <span style={styles.errorSmallIcon}>
              !
            </span>

            {error}
          </div>
        )}

        {/* =====================================================
            NO ANALYSIS
        ===================================================== */}

        {!analysis ? (
          <div style={styles.emptyAnalysis}>
            <div style={styles.emptyIcon}>
              ✦
            </div>

            <div style={styles.emptyBadge}>
              READY TO ANALYZE
            </div>

            <h2 style={styles.emptyTitle}>
              Your analysis is waiting
            </h2>

            <p style={styles.emptyDescription}>
              Let AI evaluate your idea and
              provide market insights,
              competition analysis, risks,
              opportunities and actionable
              recommendations.
            </p>

            <button
              style={styles.primaryButton}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing
                ? "Analyzing..."
                : "Start AI Analysis →"}
            </button>
          </div>
        ) : isLocal ? (
          <LocalAnalysis analysis={analysis} />
        ) : (
          <TechAnalysis analysis={analysis} />
        )}
      </div>
    </div>
  );
};

/* =====================================================
   TECH ANALYSIS
===================================================== */

const TechAnalysis = ({ analysis }) => {
  return (
    <>
      {/* =====================================================
          OVERALL SCORE
      ===================================================== */}

      <div style={styles.scoreHero}>
        <div style={styles.scoreHeroContent}>
          <div style={styles.sectionEyebrow}>
            AI EVALUATION
          </div>

          <h2 style={styles.scoreHeroTitle}>
            Overall Idea Score
          </h2>

          <p style={styles.scoreHeroText}>
            This score represents the overall
            potential of your project based on
            competition, demand, development,
            monetization and SEO opportunity.
          </p>
        </div>

        <div style={styles.scoreCircle}>
          <div style={styles.scoreCircleInner}>
            <span style={styles.scoreNumber}>
              {analysis.overallScore ?? 0}
            </span>

            <span style={styles.scoreOutOf}>
              / 100
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN SCORES
      ===================================================== */}

      <SectionHeading
        eyebrow="CORE METRICS"
        title="Project Health"
      />

      <div style={styles.scoreGrid}>
        <ScoreCard
          icon="◈"
          title="Competition"
          level={analysis.competition}
          score={
            analysis.scores?.competition
          }
        />

        <ScoreCard
          icon="↗"
          title="Demand"
          level={analysis.demand}
          score={analysis.scores?.demand}
        />

        <ScoreCard
          icon="⌘"
          title="Development"
          level={analysis.development}
          score={
            analysis.scores?.development
          }
        />

        <ScoreCard
          icon="$"
          title="Monetization"
          level={analysis.monetization}
          score={
            analysis.scores?.monetization
          }
        />

        <ScoreCard
          icon="◎"
          title="SEO Opportunity"
          level={analysis.seo}
          score={analysis.scores?.seo}
        />
      </div>

      {/* =====================================================
          MARKET INSIGHTS
      ===================================================== */}

      <SectionHeading
        eyebrow="MARKET INTELLIGENCE"
        title="Market Insights"
      />

      <div style={styles.grid}>
        <ListCard
          icon="◎"
          title="Target Users"
          items={analysis.targetUsers}
          emptyText="No target users available"
        />

        <ListCard
          icon="◈"
          title="Competitors"
          items={analysis.competitors}
          emptyText="No competitors available"
        />

        <ListCard
          icon="✦"
          title="Differentiation Opportunities"
          items={analysis.differentiation}
          emptyText="No differentiation suggestions available"
        />

        <ListCard
          icon="⌘"
          title="Required APIs"
          items={analysis.requiredApis}
          emptyText="No API recommendations available"
        />
      </div>

      {/* =====================================================
          COST
      ===================================================== */}

      <div style={styles.costCard}>
        <div style={styles.costIcon}>
          $
        </div>

        <div>
          <div style={styles.costEyebrow}>
            ESTIMATED DEVELOPMENT
          </div>

          <h2 style={styles.costTitle}>
            MVP Development Cost
          </h2>

          <p style={styles.costValue}>
            {analysis.estimatedCost ||
              "Not available"}
          </p>
        </div>
      </div>

      {/* =====================================================
          PRODUCT EVALUATION
      ===================================================== */}

      <SectionHeading
        eyebrow="PRODUCT STRATEGY"
        title="Product Evaluation"
      />

      <div style={styles.grid}>
        <ListCard
          icon="✓"
          title="Strengths"
          items={analysis.strengths}
          emptyText="No strengths available"
        />

        <ListCard
          icon="!"
          title="Weaknesses"
          items={analysis.weaknesses}
          emptyText="No weaknesses available"
        />

        <ListCard
          icon="⚠"
          title="Market Risks"
          items={analysis.marketRisks}
          emptyText="No risks available"
        />

        <ListCard
          icon="$"
          title="Monetization Strategies"
          items={
            analysis.monetizationStrategies
          }
          emptyText="No monetization strategies available"
        />
      </div>

      {/* =====================================================
          MVP FEATURES
      ===================================================== */}

      <SectionHeading
        eyebrow="BUILD PLAN"
        title="Recommended MVP Features"
      />

      <ListCard
        icon="✦"
        title="Essential Features for Version 1"
        items={analysis.mvpFeatures}
        emptyText="No MVP features available"
      />

      {/* =====================================================
          ROADMAP
      ===================================================== */}

      <SectionHeading
        eyebrow="EXECUTION"
        title="Development Roadmap"
      />

      {analysis.roadmap?.length > 0 ? (
        <div style={styles.roadmap}>
          {analysis.roadmap.map(
            (step, index) => (
              <div
                key={index}
                style={styles.roadmapItem}
              >
                <div style={styles.roadmapNumber}>
                  {String(index + 1).padStart(
                    2,
                    "0"
                  )}
                </div>

                <div style={styles.roadmapLine} />

                <div style={styles.roadmapContent}>
                  <div style={styles.phase}>
                    {step.phase ||
                      `Phase ${index + 1}`}
                  </div>

                  <h3
                    style={styles.roadmapTitle}
                  >
                    {step.title ||
                      "Development Step"}
                  </h3>

                  <p
                    style={
                      styles.roadmapDescription
                    }
                  >
                    {step.description || ""}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div style={styles.emptyCard}>
          No roadmap available
        </div>
      )}

      {/* =====================================================
          FINAL RECOMMENDATION
      ===================================================== */}

      <SectionHeading
        eyebrow="AI VERDICT"
        title="Final AI Recommendation"
      />

      <div style={styles.recommendationCard}>
        <div style={styles.recommendationIcon}>
          ✦
        </div>

        <div style={styles.recommendationContent}>
          <div style={styles.recommendationLabel}>
            AI RECOMMENDATION
          </div>

          <p style={styles.recommendationText}>
            {analysis.recommendation ||
              "No recommendation available."}
          </p>
        </div>
      </div>
    </>
  );
};

/* =====================================================
   LOCAL BUSINESS ANALYSIS
===================================================== */

const LocalAnalysis = ({ analysis }) => {
  const competition =
    analysis.competition || {};

  const reviewInsights =
    analysis.reviewInsights || {};

  const customerInsights =
    analysis.customerInsights || {};

  return (
    <>
      {/* =====================================================
          OPPORTUNITY OVERVIEW
      ===================================================== */}

      <div style={styles.localHero}>
        <div style={styles.localHeroContent}>
          <div style={styles.sectionEyebrow}>
            MARKET OPPORTUNITY
          </div>

          <div style={styles.verdictLabel}>
            OVERALL VERDICT
          </div>

          <h2 style={styles.verdict}>
            {analysis.overallVerdict ||
              "Not Available"}
          </h2>

          <p style={styles.localSummary}>
            {analysis.marketSummary ||
              "No market summary available."}
          </p>
        </div>

        <div style={styles.opportunityCircle}>
          <span style={styles.opportunityNumber}>
            {analysis.opportunityScore ?? 0}
          </span>

          <span style={styles.opportunityLabel}>
            / 100
          </span>

          <span style={styles.opportunityText}>
            OPPORTUNITY
          </span>
        </div>
      </div>

      {/* =====================================================
          COMPETITION OVERVIEW
      ===================================================== */}

      <SectionHeading
        eyebrow="LOCAL MARKET"
        title="Competition Overview"
      />

      <div style={styles.statGrid}>
        <StatCard
          icon="⌂"
          title="Competitors"
          value={
            competition.totalCompetitors ?? 0
          }
        />

        <StatCard
          icon="⚡"
          title="Competition Score"
          value={`${analysis.competitionScore ?? competition.score ?? 0}/100`}
        />

        <StatCard
          icon="◈"
          title="Competition Level"
          value={
            analysis.competitionLevel ||
            competition.level ||
            "Unknown"
          }
        />

        <StatCard
          icon="★"
          title="Average Rating"
          value={
            competition.averageRating
              ? `${competition.averageRating}/5`
              : "N/A"
          }
        />

        <StatCard
          icon="▤"
          title="Total Reviews"
          value={
            competition.totalReviews ?? 0
          }
        />

        <StatCard
          icon="●"
          title="Within 500m"
          value={
            competition.within500m ?? 0
          }
        />

        <StatCard
          icon="●"
          title="Within 1km"
          value={
            competition.within1km ?? 0
          }
        />

        <StatCard
          icon="●"
          title="Within 3km"
          value={
            competition.within3km ?? 0
          }
        />
      </div>

      {/* =====================================================
          COMPETITION SUMMARY
      ===================================================== */}

      <div style={styles.infoCard}>
        <div style={styles.infoIcon}>
          ◈
        </div>

        <div>
          <div style={styles.infoEyebrow}>
            MARKET INTELLIGENCE
          </div>

          <h3 style={styles.infoTitle}>
            Competition Summary
          </h3>

          <p style={styles.infoText}>
            {analysis.competitionSummary ||
              "No competition summary available."}
          </p>
        </div>
      </div>

      {/* =====================================================
          NEARBY COMPETITORS
      ===================================================== */}

      <SectionHeading
        eyebrow="COMPETITOR INTELLIGENCE"
        title="Nearby Competitors"
      />

      {competition.competitors?.length >
      0 ? (
        <div style={styles.competitorGrid}>
          {competition.competitors.map(
            (competitor, index) => (
              <CompetitorCard
                key={
                  competitor.placeId ||
                  index
                }
                competitor={competitor}
                index={index}
              />
            )
          )}
        </div>
      ) : (
        <div style={styles.emptyCard}>
          No competitors found.
        </div>
      )}

      {/* =====================================================
          CUSTOMER INSIGHTS
      ===================================================== */}

      <SectionHeading
        eyebrow="CUSTOMER INTELLIGENCE"
        title="Customer Insights"
      />

      <div style={styles.grid}>
        <ListCard
          icon="♥"
          title="What Customers Like"
          items={
            customerInsights.whatCustomersLike
          }
          emptyText="No customer preferences identified"
        />

        <ListCard
          icon="!"
          title="Common Complaints"
          items={
            customerInsights.commonComplaints
          }
          emptyText="No common complaints identified"
        />

        <ListCard
          icon="✦"
          title="Unmet Needs"
          items={
            customerInsights.unmetNeeds
          }
          emptyText="No unmet needs identified"
        />
      </div>

      {/* =====================================================
          REVIEW INTELLIGENCE
      ===================================================== */}

      <SectionHeading
        eyebrow="REVIEW INTELLIGENCE"
        title="Review Intelligence"
      />

      <div style={styles.reviewOverview}>
        <StatCard
          icon="⌂"
          title="Businesses Analyzed"
          value={
            reviewInsights.competitorsAnalyzed ??
            0
          }
        />

        <StatCard
          icon="▤"
          title="Reviews Analyzed"
          value={
            reviewInsights.totalReviewsAnalyzed ??
            0
          }
        />
      </div>

      {reviewInsights.businesses?.length >
        0 && (
        <div style={styles.reviewGrid}>
          {reviewInsights.businesses.map(
            (business, index) => (
              <ReviewInsightCard
                key={
                  business.businessId ||
                  index
                }
                business={business}
              />
            )
          )}
        </div>
      )}

      {/* =====================================================
          COMPETITOR STRENGTHS
      ===================================================== */}

      <SectionHeading
        eyebrow="COMPETITIVE ADVANTAGE"
        title="Competitor Strengths"
      />

      <ListCard
        icon="✓"
        title="What Existing Competitors Do Well"
        items={
          analysis.competitorStrengths
        }
        emptyText="No competitor strengths identified"
      />

      {/* =====================================================
          COMPETITOR WEAKNESSES
      ===================================================== */}

      <SectionHeading
        eyebrow="MARKET GAPS"
        title="Competitor Weaknesses"
      />

      <ListCard
        icon="!"
        title="Potential Gaps in the Existing Market"
        items={
          analysis.competitorWeaknesses
        }
        emptyText="No competitor weaknesses identified"
      />

      {/* =====================================================
          BUSINESS OPPORTUNITIES
      ===================================================== */}

      <SectionHeading
        eyebrow="GROWTH"
        title="Business Opportunities"
      />

      <ListCard
        icon="↗"
        title="Opportunities You Could Exploit"
        items={
          analysis.businessOpportunities
        }
        emptyText="No specific opportunities identified"
      />

      {/* =====================================================
          DIFFERENTIATION
      ===================================================== */}

      <SectionHeading
        eyebrow="POSITIONING"
        title="Differentiation Strategies"
      />

      <ListCard
        icon="✦"
        title="How Your Business Could Stand Out"
        items={
          analysis.differentiationStrategies
        }
        emptyText="No differentiation strategies available"
      />

      {/* =====================================================
          RISKS
      ===================================================== */}

      <SectionHeading
        eyebrow="RISK ANALYSIS"
        title="Market Risks"
      />

      <ListCard
        icon="⚠"
        title="Risks to Consider"
        items={analysis.risks}
        emptyText="No major risks identified"
      />

      {/* =====================================================
          RECOMMENDATIONS
      ===================================================== */}

      <SectionHeading
        eyebrow="AI STRATEGY"
        title="Recommendations"
      />

      <ListCard
        icon="✦"
        title="AI Recommendations"
        items={
          analysis.recommendations
        }
        emptyText="No recommendations available"
      />

      {/* =====================================================
          NEXT STEPS
      ===================================================== */}

      <SectionHeading
        eyebrow="ACTION PLAN"
        title="Recommended Next Steps"
      />

      <ListCard
        icon="→"
        title="What You Should Do Next"
        items={
          analysis.recommendedNextSteps
        }
        emptyText="No next steps available"
      />
    </>
  );
};

/* =====================================================
   SECTION HEADING
===================================================== */

const SectionHeading = ({
  eyebrow,
  title,
  children,
}) => {
  return (
    <div style={styles.sectionHeading}>
      <div style={styles.sectionEyebrow}>
        {eyebrow}
      </div>

      <h2 style={styles.mainHeading}>
        {title || children}
      </h2>
    </div>
  );
};

/* =====================================================
   SCORE CARD
===================================================== */

const ScoreCard = ({
  icon,
  title,
  level,
  score,
}) => {
  const numericScore = Number(score ?? 0);

  return (
    <div style={styles.scoreCard}>
      <div style={styles.scoreCardTop}>
        <div style={styles.scoreIcon}>
          {icon}
        </div>

        <span style={styles.scoreCardTitle}>
          {title}
        </span>
      </div>

      <div style={styles.scoreLevel}>
        {level || "Medium"}
      </div>

      <div style={styles.scoreBottom}>
        <span style={styles.smallScore}>
          {numericScore}/100
        </span>

        <div style={styles.scoreBar}>
          <div
            style={{
              ...styles.scoreBarFill,
              width: `${Math.min(
                Math.max(numericScore, 0),
                100
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/* =====================================================
   STAT CARD
===================================================== */

const StatCard = ({
  icon,
  title,
  value,
}) => {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardTop}>
        <div style={styles.statIcon}>
          {icon}
        </div>

        <span style={styles.statTitle}>
          {title}
        </span>
      </div>

      <div style={styles.statValue}>
        {value}
      </div>
    </div>
  );
};

/* =====================================================
   LIST CARD
===================================================== */

const ListCard = ({
  icon,
  title,
  items,
  emptyText,
}) => {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        {icon && (
          <div style={styles.cardIcon}>
            {icon}
          </div>
        )}

        <h3 style={styles.cardTitle}>
          {title}
        </h3>
      </div>

      {Array.isArray(items) &&
      items.length > 0 ? (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li
              key={index}
              style={styles.listItem}
            >
              <span style={styles.listBullet}>
                →
              </span>

              <span>
                {typeof item === "string"
                  ? item
                  : JSON.stringify(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={styles.emptyText}>
          {emptyText}
        </p>
      )}
    </div>
  );
};

/* =====================================================
   COMPETITOR CARD
===================================================== */

const CompetitorCard = ({
  competitor,
  index,
}) => {
  return (
    <div style={styles.competitorCard}>
      <div style={styles.competitorTop}>
        <div style={styles.competitorNumber}>
          #{String(index + 1).padStart(2, "0")}
        </div>

        <div style={styles.competitorRating}>
          ★{" "}
          {competitor.rating || "N/A"}
        </div>
      </div>

      <h3 style={styles.competitorName}>
        {competitor.name ||
          "Unknown Business"}
      </h3>

      <div style={styles.competitorDetails}>
        <span>
          ▤{" "}
          {competitor.reviewCount ?? 0}{" "}
          reviews
        </span>

        <span>
          ◉{" "}
          {competitor.distanceKm !==
          null
            ? `${competitor.distanceKm} km`
            : "Distance unavailable"}
        </span>
      </div>

      {competitor.address && (
        <p style={styles.competitorAddress}>
          {competitor.address}
        </p>
      )}

      {competitor.phone && (
        <p style={styles.competitorContact}>
          ☎ {competitor.phone}
        </p>
      )}

      {competitor.website && (
        <p style={styles.competitorWebsite}>
          ◉ {competitor.website}
        </p>
      )}
    </div>
  );
};

/* =====================================================
   REVIEW INSIGHT CARD
===================================================== */

const ReviewInsightCard = ({
  business,
}) => {
  const insights =
    business.insights || {};

  return (
    <div style={styles.reviewCard}>
      <div style={styles.reviewHeader}>
        <div>
          <div style={styles.reviewBusinessTag}>
            BUSINESS
          </div>

          <h3
            style={styles.reviewBusinessName}
          >
            {business.businessName}
          </h3>

          <div style={styles.reviewMeta}>
            ★ {business.rating || "N/A"}
            {" · "}
            {business.reviewCount ?? 0}{" "}
            reviews
          </div>
        </div>

        <span style={styles.reviewCount}>
          {business.reviewsAnalyzed ?? 0}{" "}
          analyzed
        </span>
      </div>

      <p style={styles.reviewSummary}>
        {insights.summary ||
          "No summary available."}
      </p>

      <div style={styles.reviewColumns}>
        <ReviewList
          title="Strengths"
          items={insights.strengths}
        />

        <ReviewList
          title="Weaknesses"
          items={insights.weaknesses}
        />

        <ReviewList
          title="Complaints"
          items={
            insights.commonComplaints
          }
        />

        <ReviewList
          title="Opportunities"
          items={insights.opportunities}
        />
      </div>

      <div style={styles.sentiment}>
        <span>
          Sentiment:{" "}
          <strong>
            {insights.overallSentiment ||
              "Unknown"}
          </strong>
        </span>

        <span style={styles.sentimentDivider}>
          •
        </span>

        <span>
          Confidence:{" "}
          <strong>
            {insights.confidence ||
              "Unknown"}
          </strong>
        </span>
      </div>
    </div>
  );
};

/* =====================================================
   REVIEW LIST
===================================================== */

const ReviewList = ({
  title,
  items,
}) => {
  return (
    <div>
      <h4 style={styles.reviewListTitle}>
        {title}
      </h4>

      {Array.isArray(items) &&
      items.length > 0 ? (
        <ul style={styles.reviewList}>
          {items.map((item, index) => (
            <li key={index}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p style={styles.noData}>
          No data
        </p>
      )}
    </div>
  );
};

/* =====================================================
   STYLES
===================================================== */

const styles = {
  /* =====================================================
     PAGE
  ===================================================== */

  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #070b17 0%, #0b1020 45%, #111936 100%)",
    color: "#f8fafc",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    padding: "0 0 80px",
  },

  container: {
    width: "100%",
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "35px 24px 0",
    boxSizing: "border-box",
  },

  /* =====================================================
     HEADER
  ===================================================== */

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "30px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },

  headerLeft: {
    minWidth: 0,
    flex: "1 1 600px",
  },

  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "0",
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "25px",
  },

  backArrow: {
    fontSize: "18px",
  },

  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 12px",
    borderRadius: "999px",
    background:
      "rgba(37, 99, 235, 0.12)",
    border:
      "1px solid rgba(96, 165, 250, 0.22)",
    color: "#93c5fd",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.2px",
    marginBottom: "13px",
  },

  headerBadgeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#60a5fa",
    boxShadow:
      "0 0 10px rgba(96, 165, 250, 0.8)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 44px)",
    lineHeight: "1.1",
    letterSpacing: "-1.5px",
    color: "#f8fafc",
    fontWeight: "800",
  },

  subtitle: {
    margin: "12px 0 0",
    maxWidth: "700px",
    fontSize: "15px",
    lineHeight: "1.7",
    color: "#94a3b8",
  },

  analyzeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    minHeight: "48px",
    padding: "0 20px",
    border: "1px solid rgba(96, 165, 250, 0.35)",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    boxShadow:
      "0 10px 30px rgba(37, 99, 235, 0.22)",
    whiteSpace: "nowrap",
  },

  analyzeButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  buttonIcon: {
    fontSize: "16px",
  },

  /* =====================================================
     IDEA CARD
  ===================================================== */

  ideaCard: {
    padding: "25px",
    marginBottom: "35px",
    borderRadius: "18px",
    border:
      "1px solid rgba(148, 163, 184, 0.14)",
    background:
      "linear-gradient(145deg, rgba(17, 25, 54, 0.95), rgba(10, 15, 31, 0.95))",
    boxShadow:
      "0 20px 50px rgba(0, 0, 0, 0.22)",
  },

  ideaCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },

  badgeGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  category: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 11px",
    borderRadius: "999px",
    background:
      "rgba(37, 99, 235, 0.16)",
    border:
      "1px solid rgba(96, 165, 250, 0.2)",
    color: "#93c5fd",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.4px",
  },

  localBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 11px",
    borderRadius: "999px",
    background:
      "rgba(16, 185, 129, 0.1)",
    border:
      "1px solid rgba(52, 211, 153, 0.2)",
    color: "#6ee7b7",
    fontSize: "11px",
    fontWeight: "800",
  },

  ideaId: {
    color: "#64748b",
    fontSize: "11px",
    fontFamily:
      "monospace",
  },

  ideaTitle: {
    margin: "18px 0 9px",
    color: "#f8fafc",
    fontSize: "24px",
    lineHeight: "1.3",
  },

  description: {
    margin: 0,
    maxWidth: "950px",
    lineHeight: "1.75",
    color: "#94a3b8",
    fontSize: "14px",
  },

  businessInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "20px",
    paddingTop: "18px",
    borderTop:
      "1px solid rgba(148, 163, 184, 0.12)",
  },

  businessInfoLabel: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#64748b",
  },

  businessInfoValue: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#cbd5e1",
  },

  /* =====================================================
     ERROR
  ===================================================== */

  error: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    marginBottom: "25px",
    borderRadius: "12px",
    background:
      "rgba(127, 29, 29, 0.25)",
    border:
      "1px solid rgba(248, 113, 113, 0.25)",
    color: "#fca5a5",
    fontSize: "14px",
  },

  errorSmallIcon: {
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "rgba(239, 68, 68, 0.18)",
    fontWeight: "800",
  },

  /* =====================================================
     LOADING
  ===================================================== */

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background:
      "linear-gradient(135deg, #070b17, #111936)",
    fontFamily:
      "Inter, Arial, sans-serif",
  },

  loadingCard: {
    width: "100%",
    maxWidth: "420px",
    padding: "45px 30px",
    borderRadius: "20px",
    textAlign: "center",
    background:
      "rgba(17, 25, 54, 0.9)",
    border:
      "1px solid rgba(148, 163, 184, 0.15)",
  },

  loadingSpinner: {
    width: "45px",
    height: "45px",
    margin: "0 auto 20px",
    borderRadius: "50%",
    border:
      "4px solid rgba(96, 165, 250, 0.18)",
    borderTopColor: "#60a5fa",
  },

  loadingTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
  },

  loadingText: {
    margin: 0,
    color: "#94a3b8",
  },

  /* =====================================================
     ERROR PAGE
  ===================================================== */

  errorPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background:
      "linear-gradient(135deg, #070b17, #111936)",
    fontFamily:
      "Inter, Arial, sans-serif",
  },

  errorCard: {
    width: "100%",
    maxWidth: "480px",
    padding: "45px 30px",
    textAlign: "center",
    borderRadius: "20px",
    background:
      "rgba(17, 25, 54, 0.95)",
    border:
      "1px solid rgba(148, 163, 184, 0.15)",
  },

  errorIcon: {
    width: "55px",
    height: "55px",
    margin: "0 auto 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "rgba(239, 68, 68, 0.15)",
    color: "#fca5a5",
    fontSize: "24px",
    fontWeight: "800",
  },

  errorTitle: {
    margin: "0 0 10px",
    color: "#f8fafc",
  },

  errorMessage: {
    margin: "0 0 25px",
    color: "#94a3b8",
    lineHeight: "1.6",
  },

  /* =====================================================
     BUTTON
  ===================================================== */

  primaryButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: "11px",
    cursor: "pointer",
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    boxShadow:
      "0 10px 25px rgba(37, 99, 235, 0.2)",
  },

  /* =====================================================
     EMPTY ANALYSIS
  ===================================================== */

  emptyAnalysis: {
    padding: "70px 25px",
    textAlign: "center",
    borderRadius: "20px",
    border:
      "1px dashed rgba(96, 165, 250, 0.3)",
    background:
      "linear-gradient(145deg, rgba(17, 25, 54, 0.8), rgba(10, 15, 31, 0.8))",
  },

  emptyIcon: {
    width: "70px",
    height: "70px",
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "20px",
    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#ffffff",
    fontSize: "30px",
    boxShadow:
      "0 15px 35px rgba(37, 99, 235, 0.25)",
  },

  emptyBadge: {
    display: "inline-block",
    marginBottom: "12px",
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px",
  },

  emptyTitle: {
    margin: "0 0 12px",
    color: "#f8fafc",
    fontSize: "26px",
  },

  emptyDescription: {
    maxWidth: "600px",
    margin: "0 auto 25px",
    color: "#94a3b8",
    lineHeight: "1.7",
    fontSize: "14px",
  },

  /* =====================================================
     SCORE HERO
  ===================================================== */

  scoreHero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "35px",
    padding: "35px",
    marginBottom: "40px",
    borderRadius: "22px",
    border:
      "1px solid rgba(96, 165, 250, 0.2)",
    background:
      "linear-gradient(135deg, rgba(30, 64, 175, 0.22), rgba(76, 29, 149, 0.2), rgba(10, 15, 31, 0.9))",
    boxShadow:
      "0 25px 60px rgba(0, 0, 0, 0.2)",
    flexWrap: "wrap",
  },

  scoreHeroContent: {
    flex: "1 1 500px",
    minWidth: 0,
  },

  sectionEyebrow: {
    marginBottom: "8px",
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.7px",
  },

  scoreHeroTitle: {
    margin: "0 0 10px",
    color: "#f8fafc",
    fontSize: "27px",
  },

  scoreHeroText: {
    maxWidth: "650px",
    margin: 0,
    color: "#94a3b8",
    lineHeight: "1.7",
    fontSize: "14px",
  },

  scoreCircle: {
    width: "155px",
    height: "155px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "conic-gradient(#60a5fa, #6366f1, #8b5cf6, #60a5fa)",
    boxShadow:
      "0 0 45px rgba(96, 165, 250, 0.18)",
  },

  scoreCircleInner: {
    width: "133px",
    height: "133px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background: "#0c1226",
  },

  scoreNumber: {
    fontSize: "43px",
    fontWeight: "800",
    lineHeight: "1",
    color: "#f8fafc",
  },

  scoreOutOf: {
    marginTop: "5px",
    fontSize: "12px",
    color: "#64748b",
  },

  /* =====================================================
     SECTION
  ===================================================== */

  sectionHeading: {
    marginTop: "45px",
    marginBottom: "20px",
  },

  mainHeading: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "24px",
    fontWeight: "750",
    letterSpacing: "-0.4px",
  },

  /* =====================================================
     SCORE GRID
  ===================================================== */

  scoreGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  },

  scoreCard: {
    padding: "20px",
    borderRadius: "16px",
    border:
      "1px solid rgba(148, 163, 184, 0.13)",
    background:
      "rgba(17, 25, 54, 0.8)",
    boxShadow:
      "0 12px 30px rgba(0, 0, 0, 0.14)",
  },

  scoreCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "17px",
  },

  scoreIcon: {
    width: "34px",
    height: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9px",
    background:
      "rgba(37, 99, 235, 0.15)",
    color: "#60a5fa",
    fontWeight: "800",
  },

  scoreCardTitle: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "600",
  },

  scoreLevel: {
    marginBottom: "12px",
    color: "#f8fafc",
    fontSize: "21px",
    fontWeight: "800",
  },

  scoreBottom: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  smallScore: {
    flexShrink: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
  },

  scoreBar: {
    height: "5px",
    flex: 1,
    overflow: "hidden",
    borderRadius: "999px",
    background:
      "rgba(148, 163, 184, 0.12)",
  },

  scoreBarFill: {
    height: "100%",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, #2563eb, #8b5cf6)",
  },

  /* =====================================================
     GRID
  ===================================================== */

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },

  /* =====================================================
     CARD
  ===================================================== */

  card: {
    padding: "22px",
    borderRadius: "17px",
    border:
      "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "rgba(17, 25, 54, 0.75)",
    boxShadow:
      "0 12px 30px rgba(0, 0, 0, 0.12)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "17px",
  },

  cardIcon: {
    width: "32px",
    height: "32px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background:
      "rgba(37, 99, 235, 0.13)",
    color: "#60a5fa",
    fontSize: "14px",
    fontWeight: "800",
  },

  cardTitle: {
    margin: 0,
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "700",
  },

  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },

  listItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    marginBottom: "11px",
    color: "#94a3b8",
    lineHeight: "1.6",
    fontSize: "13px",
  },

  listBullet: {
    flexShrink: 0,
    color: "#60a5fa",
    fontWeight: "800",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
  },

  /* =====================================================
     COST
  ===================================================== */

  costCard: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    marginTop: "18px",
    padding: "25px",
    borderRadius: "17px",
    border:
      "1px solid rgba(52, 211, 153, 0.18)",
    background:
      "linear-gradient(135deg, rgba(6, 78, 59, 0.25), rgba(17, 25, 54, 0.85))",
  },

  costIcon: {
    width: "52px",
    height: "52px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    background:
      "rgba(16, 185, 129, 0.12)",
    color: "#6ee7b7",
    fontSize: "22px",
    fontWeight: "800",
  },

  costEyebrow: {
    marginBottom: "5px",
    color: "#6ee7b7",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.3px",
  },

  costTitle: {
    margin: 0,
    color: "#e2e8f0",
    fontSize: "15px",
  },

  costValue: {
    margin: "6px 0 0",
    color: "#6ee7b7",
    fontSize: "26px",
    fontWeight: "800",
  },

  /* =====================================================
     ROADMAP
  ===================================================== */

  roadmap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  roadmapItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "17px",
    padding: "21px",
    borderRadius: "16px",
    border:
      "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "rgba(17, 25, 54, 0.75)",
  },

  roadmapNumber: {
    width: "43px",
    height: "43px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "11px",
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "800",
  },

  roadmapLine: {
    width: "1px",
    alignSelf: "stretch",
    background:
      "rgba(96, 165, 250, 0.16)",
  },

  roadmapContent: {
    minWidth: 0,
  },

  phase: {
    marginBottom: "5px",
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
  },

  roadmapTitle: {
    margin: "0 0 7px",
    color: "#e2e8f0",
    fontSize: "17px",
  },

  roadmapDescription: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: "1.65",
    fontSize: "13px",
  },

  /* =====================================================
     RECOMMENDATION
  ===================================================== */

  recommendationCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "18px",
    padding: "28px",
    borderRadius: "19px",
    border:
      "1px solid rgba(139, 92, 246, 0.25)",
    background:
      "linear-gradient(135deg, rgba(76, 29, 149, 0.24), rgba(30, 41, 90, 0.28), rgba(17, 25, 54, 0.85))",
  },

  recommendationIcon: {
    width: "45px",
    height: "45px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    fontSize: "18px",
  },

  recommendationContent: {
    minWidth: 0,
  },

  recommendationLabel: {
    marginBottom: "8px",
    color: "#a78bfa",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.4px",
  },

  recommendationText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: "1.8",
    fontSize: "15px",
  },

  /* =====================================================
     LOCAL HERO
  ===================================================== */

  localHero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "35px",
    padding: "35px",
    borderRadius: "22px",
    border:
      "1px solid rgba(96, 165, 250, 0.18)",
    background:
      "linear-gradient(135deg, rgba(30, 64, 175, 0.2), rgba(17, 25, 54, 0.9))",
    boxShadow:
      "0 25px 60px rgba(0, 0, 0, 0.2)",
    flexWrap: "wrap",
  },

  localHeroContent: {
    flex: "1 1 600px",
    minWidth: 0,
  },

  verdictLabel: {
    marginTop: "10px",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.2px",
  },

  verdict: {
    margin: "7px 0 12px",
    color: "#f8fafc",
    fontSize: "clamp(25px, 4vw, 34px)",
    lineHeight: "1.2",
  },

  localSummary: {
    maxWidth: "750px",
    margin: 0,
    color: "#94a3b8",
    lineHeight: "1.75",
    fontSize: "14px",
  },

  opportunityCircle: {
    width: "160px",
    height: "160px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    borderRadius: "50%",
    background:
      "conic-gradient(#34d399, #60a5fa, #8b5cf6, #34d399)",
    boxShadow:
      "0 0 45px rgba(52, 211, 153, 0.14)",
  },

  opportunityNumber: {
    fontSize: "41px",
    lineHeight: "1",
    fontWeight: "800",
    color: "#ffffff",
  },

  opportunityLabel: {
    marginTop: "5px",
    color: "#94a3b8",
    fontSize: "11px",
  },

  opportunityText: {
    marginTop: "7px",
    color: "#6ee7b7",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1.2px",
  },

  /* =====================================================
     STAT GRID
  ===================================================== */

  statGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(175px, 1fr))",
    gap: "13px",
  },

  statCard: {
    padding: "19px",
    borderRadius: "15px",
    border:
      "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "rgba(17, 25, 54, 0.75)",
  },

  statCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginBottom: "13px",
  },

  statIcon: {
    width: "31px",
    height: "31px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background:
      "rgba(37, 99, 235, 0.12)",
    color: "#60a5fa",
    fontSize: "13px",
    fontWeight: "800",
  },

  statTitle: {
    color: "#64748b",
    fontSize: "11px",
    lineHeight: "1.3",
  },

  statValue: {
    color: "#f8fafc",
    fontSize: "21px",
    fontWeight: "800",
    wordBreak: "break-word",
  },

  /* =====================================================
     INFO CARD
  ===================================================== */

  infoCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "17px",
    marginTop: "18px",
    padding: "23px",
    borderRadius: "17px",
    border:
      "1px solid rgba(96, 165, 250, 0.15)",
    background:
      "rgba(17, 25, 54, 0.75)",
  },

  infoIcon: {
    width: "40px",
    height: "40px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background:
      "rgba(37, 99, 235, 0.13)",
    color: "#60a5fa",
    fontWeight: "800",
  },

  infoEyebrow: {
    marginBottom: "4px",
    color: "#60a5fa",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1.3px",
  },

  infoTitle: {
    margin: "0 0 8px",
    color: "#e2e8f0",
    fontSize: "17px",
  },

  infoText: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: "1.7",
    fontSize: "13px",
  },

  /* =====================================================
     COMPETITORS
  ===================================================== */

  competitorGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "15px",
  },

  competitorCard: {
    position: "relative",
    padding: "21px",
    borderRadius: "17px",
    border:
      "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "rgba(17, 25, 54, 0.78)",
    boxShadow:
      "0 12px 30px rgba(0, 0, 0, 0.12)",
  },

  competitorTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "15px",
  },

  competitorNumber: {
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.7px",
  },

  competitorRating: {
    padding: "5px 9px",
    borderRadius: "7px",
    background:
      "rgba(245, 158, 11, 0.1)",
    color: "#fbbf24",
    fontSize: "12px",
    fontWeight: "800",
  },

  competitorName: {
    margin: "0 0 13px",
    color: "#f8fafc",
    fontSize: "17px",
    lineHeight: "1.35",
  },

  competitorDetails: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    color: "#94a3b8",
    fontSize: "12px",
  },

  competitorAddress: {
    margin: "16px 0 0",
    paddingTop: "13px",
    borderTop:
      "1px solid rgba(148, 163, 184, 0.1)",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "1.55",
  },

  competitorContact: {
    margin: "10px 0 0",
    color: "#94a3b8",
    fontSize: "12px",
  },

  competitorWebsite: {
    margin: "10px 0 0",
    color: "#60a5fa",
    fontSize: "12px",
    wordBreak: "break-all",
  },

  /* =====================================================
     REVIEW
  ===================================================== */

  reviewOverview: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "13px",
  },

  reviewGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    marginTop: "16px",
  },

  reviewCard: {
    padding: "24px",
    borderRadius: "18px",
    border:
      "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "rgba(17, 25, 54, 0.78)",
  },

  reviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    flexWrap: "wrap",
  },

  reviewBusinessTag: {
    marginBottom: "5px",
    color: "#60a5fa",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1.2px",
  },

  reviewBusinessName: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "18px",
  },

  reviewMeta: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "12px",
  },

  reviewCount: {
    padding: "7px 10px",
    borderRadius: "999px",
    background:
      "rgba(37, 99, 235, 0.13)",
    border:
      "1px solid rgba(96, 165, 250, 0.14)",
    color: "#93c5fd",
    fontSize: "10px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  reviewSummary: {
    margin: "20px 0",
    padding: "16px",
    borderRadius: "11px",
    background:
      "rgba(2, 6, 23, 0.28)",
    color: "#94a3b8",
    lineHeight: "1.7",
    fontSize: "13px",
  },

  reviewColumns: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "20px",
  },

  reviewListTitle: {
    margin: "0 0 9px",
    color: "#cbd5e1",
    fontSize: "13px",
  },

  reviewList: {
    margin: 0,
    paddingLeft: "17px",
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: "1.65",
  },

  noData: {
    margin: 0,
    color: "#475569",
    fontSize: "12px",
  },

  sentiment: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    flexWrap: "wrap",
    marginTop: "20px",
    paddingTop: "15px",
    borderTop:
      "1px solid rgba(148, 163, 184, 0.1)",
    color: "#64748b",
    fontSize: "12px",
  },

  sentimentDivider: {
    color: "#334155",
  },

  /* =====================================================
     EMPTY CARD
  ===================================================== */

  emptyCard: {
    padding: "28px",
    borderRadius: "16px",
    border:
      "1px dashed rgba(148, 163, 184, 0.18)",
    background:
      "rgba(17, 25, 54, 0.5)",
    color: "#64748b",
    textAlign: "center",
    fontSize: "13px",
  },
};

export default AnalysisResults;