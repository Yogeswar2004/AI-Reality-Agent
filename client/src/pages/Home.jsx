import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import {
  Sparkles,
  Bot,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Database,
  ArrowRight,
  Zap,
  Activity,
  Compass,
  Layers,
} from "lucide-react";

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-wrapper">
      {/* =====================================================================
          HERO SECTION
          ===================================================================== */}
      <section className="home-hero">
        <div className="hero-pill-badge">
          <Badge variant="primary" size="sm" dot>
            Autonomous Venture Intelligence
          </Badge>
        </div>

        <h1 className="hero-title">
          Test Startup Hypotheses Against{" "}
          <span className="hero-title-highlight">Real-World Evidence</span>
        </h1>

        <p className="hero-subtitle">
          IdeaReality Agent formulates structured research plans, gathers grounded
          competitor and review data, and synthesizes viability verdicts — with
          complete human authorization at every step.
        </p>

        <div className="hero-cta-group">
          <Link to="/agent">
            <Button
              variant="primary"
              size="lg"
              icon={<Sparkles size={16} />}
              iconPosition="right"
              className="hero-btn-primary"
            >
              Launch Agent Studio
            </Button>
          </Link>

          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="secondary" size="lg" className="hero-btn-secondary">
                View Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="secondary" size="lg" className="hero-btn-secondary">
                Sign In
              </Button>
            </Link>
          )}
        </div>

        {/* =====================================================================
            HERO PREVIEW / SIMULATION CARD
            ===================================================================== */}
        <div className="hero-preview-container">
          <Card variant="glass" padding="none" className="hero-preview-card">
            {/* Window bar */}
            <div className="preview-window-bar">
              <div className="preview-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="preview-status-pill">
                <Badge variant="viable" size="xs">
                  <Activity size={10} style={{ marginRight: "3px" }} />
                  Investigation Active
                </Badge>
              </div>
            </div>

            {/* Content body */}
            <div className="preview-body">
              <div className="preview-header-meta">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="preview-avatar">
                    <Bot size={14} />
                  </div>
                  <div>
                    <h4 className="preview-goal-title">
                      Specialty Cold Brew Subscription & Micro-Roastery
                    </h4>
                    <span className="preview-location-text">
                      Target Market: Denver, CO • 4 Steps Planned
                    </span>
                  </div>
                </div>

                <Badge variant="cache" size="xs">
                  <Zap size={10} style={{ marginRight: "2px" }} />
                  Cache-Accelerated
                </Badge>
              </div>

              {/* Execution Steps Mock */}
              <div className="preview-steps-grid">
                <div className="preview-step-item">
                  <div className="preview-step-icon done">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="preview-step-details">
                    <span className="step-name">Competitor Discovery</span>
                    <span className="step-result">12 local roasters mapped</span>
                  </div>
                </div>

                <div className="preview-step-item">
                  <div className="preview-step-icon done">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="preview-step-details">
                    <span className="step-name">Review Mining</span>
                    <span className="step-result">48 verified reviews parsed</span>
                  </div>
                </div>

                <div className="preview-step-item">
                  <div className="preview-step-icon done">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="preview-step-details">
                    <span className="step-name">Sentiment Analysis</span>
                    <span className="step-result">3 unmet customer needs</span>
                  </div>
                </div>

                <div className="preview-step-item active">
                  <div className="preview-step-icon current">
                    <Sparkles size={13} />
                  </div>
                  <div className="preview-step-details">
                    <span className="step-name">Verdict Synthesis</span>
                    <span className="step-result">Viable with Differentiation</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* =====================================================================
          CORE PILLARS SECTION
          ===================================================================== */}
      <section className="home-section">
        <div className="section-header">
          <Badge variant="primary" size="xs">
            Architecture
          </Badge>
          <h2 className="section-title">Engineered for Grounded Venture Discovery</h2>
          <p className="section-subtitle">
            Unlike generic chatbots, Reality Agent executes structured investigative workflows
            grounded in live market data and human judgment.
          </p>
        </div>

        <div className="pillars-grid">
          <Card variant="elevated" padding="lg" className="pillar-card">
            <div className="pillar-icon-box">
              <Compass size={20} />
            </div>
            <h3 className="pillar-title">Advisory Plan Generation</h3>
            <p className="pillar-desc">
              Analyzes your initial venture hypothesis and designs a customized sequence of market
              discovery, reviews, and sentiment tools before running anything.
            </p>
          </Card>

          <Card variant="elevated" padding="lg" className="pillar-card">
            <div className="pillar-icon-box">
              <ShieldCheck size={20} />
            </div>
            <h3 className="pillar-title">Human-in-the-Loop Governance</h3>
            <p className="pillar-desc">
              Zero unvetted execution. Review the proposed investigation plan, estimated cost, and
              tool steps, approving execution with a single click.
            </p>
          </Card>

          <Card variant="elevated" padding="lg" className="pillar-card">
            <div className="pillar-icon-box">
              <RefreshCw size={20} />
            </div>
            <h3 className="pillar-title">Adaptive Replanning</h3>
            <p className="pillar-desc">
              When tool data reveals unexpected competitive saturation or information gaps, the
              agent autonomously pivots strategy to explore deeper evidence.
            </p>
          </Card>

          <Card variant="elevated" padding="lg" className="pillar-card">
            <div className="pillar-icon-box">
              <Database size={20} />
            </div>
            <h3 className="pillar-title">Grounded Viability Verdict</h3>
            <p className="pillar-desc">
              Evidence is synthesized into a definitive assessment with confidence scores,
              competitive risks, recommended technical stacks, and action items.
            </p>
          </Card>
        </div>
      </section>

      {/* =====================================================================
          HOW IT WORKS (WORKFLOW PIPELINE)
          ===================================================================== */}
      <section className="home-section">
        <div className="section-header">
          <Badge variant="default" size="xs">
            Execution Flow
          </Badge>
          <h2 className="section-title">From Hypothesis to Defensible Evidence</h2>
          <p className="section-subtitle">
            A transparent three-stage cycle designed to prevent costly false positives.
          </p>
        </div>

        <div className="workflow-grid">
          <div className="workflow-step">
            <div className="step-number-pill">01</div>
            <h4 className="workflow-step-title">Define Hypothesis</h4>
            <p className="workflow-step-desc">
              Specify your venture goal and optional target location. Select from common archetypes
              or input your custom business model.
            </p>
          </div>

          <div className="workflow-step">
            <div className="step-number-pill">02</div>
            <h4 className="workflow-step-title">Authorize Advisory Plan</h4>
            <p className="workflow-step-desc">
              Review the agent’s proposed research sequence, budget limits, and specific tool
              invocations before releasing execution.
            </p>
          </div>

          <div className="workflow-step">
            <div className="step-number-pill">03</div>
            <h4 className="workflow-step-title">Inspect Ground Truth</h4>
            <p className="workflow-step-desc">
              Watch live step logs, inspect cached and fresh competitor reviews, and review the final
              synthesized recommendation report.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BOTTOM CTA BANNER
          ===================================================================== */}
      <section className="home-bottom-banner">
        <Card variant="glow" padding="lg" className="cta-card">
          <div className="cta-card-content">
            <div className="cta-text-side">
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <Layers size={15} style={{ color: "var(--primary-light)" }} />
                <span className="cta-kicker">Start Investigating Today</span>
              </div>
              <h3 className="cta-headline">Ready to validate your startup concept?</h3>
              <p className="cta-subtext">
                Launch the autonomous agent workspace and obtain grounded market clarity in minutes.
              </p>
            </div>

            <div className="cta-action-side">
              <Link to="/agent">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight size={16} />}
                  iconPosition="right"
                >
                  Enter Agent Studio
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* =====================================================================
          SCOPED RESPONSIVE STYLING
          ===================================================================== */}
      <style>{`
        .home-wrapper {
          width: 100%;
          min-height: calc(100vh - 56px);
          overflow-x: hidden;
          padding: 0 20px 80px;
          box-sizing: border-box;
        }

        .home-hero {
          max-width: 960px;
          margin: 0 auto;
          padding: 64px 0 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .hero-pill-badge {
          margin-bottom: 20px;
        }

        .hero-title {
          font-size: clamp(30px, 5.5vw, 54px);
          font-weight: 850;
          color: #ffffff;
          letter-spacing: -1.2px;
          line-height: 1.15;
          max-width: 820px;
          margin: 0 auto 18px;
        }

        .hero-title-highlight {
          background: linear-gradient(135deg, #c084fc, #818cf8);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-subtitle {
          font-size: clamp(14px, 2vw, 17px);
          color: var(--text-secondary);
          line-height: 1.65;
          max-width: 680px;
          margin: 0 auto 32px;
        }

        .hero-cta-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 48px;
          width: 100%;
        }

        .hero-preview-container {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }

        .hero-preview-card {
          overflow: hidden;
          border: 1px solid var(--border-default);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          text-align: left;
        }

        .preview-window-bar {
          padding: 10px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .preview-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dot {
          width: 9px;
          height: 9px;
          border-radius: var(--radius-full);
          display: inline-block;
        }
        .dot-red { background: #ef4444; opacity: 0.8; }
        .dot-yellow { background: #f59e0b; opacity: 0.8; }
        .dot-green { background: #10b981; opacity: 0.8; }

        .preview-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .preview-header-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .preview-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: var(--primary-subtle);
          color: var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .preview-goal-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .preview-location-text {
          font-size: 11px;
          color: var(--text-muted);
          display: block;
          margin-top: 2px;
        }

        .preview-steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .preview-step-item {
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .preview-step-item.active {
          border-color: var(--border-active);
          background: rgba(124, 58, 237, 0.08);
        }

        .preview-step-icon {
          width: 22px;
          height: 22px;
          border-radius: var(--radius-xs);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .preview-step-icon.done {
          background: var(--status-viable-bg);
          color: var(--status-viable);
        }

        .preview-step-icon.current {
          background: var(--primary-subtle);
          color: var(--primary-light);
        }

        .preview-step-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .step-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .step-result {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Core Section Headers */
        .home-section {
          max-width: 1080px;
          margin: 64px auto 0;
        }

        .section-header {
          text-align: center;
          margin-bottom: 36px;
        }

        .section-title {
          font-size: clamp(22px, 3.5vw, 32px);
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.5px;
          margin: 10px 0 8px;
        }

        .section-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Pillars 4-grid */
        .pillars-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 16px;
        }

        .pillar-card {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pillar-icon-box {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-sm);
          background: var(--primary-subtle);
          color: var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .pillar-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .pillar-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        /* 3-step pipeline */
        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }

        .workflow-step {
          padding: 24px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .step-number-pill {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-subtle);
          font-size: 12px;
          font-weight: 800;
          color: var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .workflow-step-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .workflow-step-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        /* Bottom CTA */
        .home-bottom-banner {
          max-width: 960px;
          margin: 80px auto 0;
        }

        .cta-card-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .cta-text-side {
          flex: 1;
          min-width: 260px;
        }

        .cta-kicker {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--primary-light);
        }

        .cta-headline {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .cta-subtext {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .cta-action-side {
          flex-shrink: 0;
        }

        /* =====================================================================
           RESPONSIVE BREAKPOINTS (360px - 768px)
           ===================================================================== */
        @media (max-width: 768px) {
          .home-wrapper {
            padding: 0 16px 60px;
          }

          .home-hero {
            padding: 40px 0 32px;
          }

          .hero-cta-group {
            flex-direction: column;
            gap: 10px;
            margin-bottom: 36px;
          }

          .hero-cta-group a,
          .hero-cta-group button {
            width: 100% !important;
            justify-content: center !important;
          }

          .preview-body {
            padding: 14px;
          }

          .preview-steps-grid {
            grid-template-columns: 1fr;
          }

          .home-section {
            margin-top: 48px;
          }

          .pillars-grid {
            grid-template-columns: 1fr;
          }

          .workflow-grid {
            grid-template-columns: 1fr;
          }

          .cta-card-content {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .cta-text-side {
            min-width: 0;
          }

          .cta-action-side a,
          .cta-action-side button {
            width: 100% !important;
            justify-content: center !important;
          }
        }

        @media (max-width: 430px) {
          .home-wrapper {
            padding: 0 12px 48px;
          }

          .hero-title {
            font-size: 27px;
            letter-spacing: -0.5px;
          }

          .section-title {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default Home;
