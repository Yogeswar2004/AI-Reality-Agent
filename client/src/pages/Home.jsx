import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-badge">
          ✨ Turn your ideas into reality
        </div>

        <h1>
          Is Your Startup Idea
          <span> Worth Building?</span>
        </h1>

        <p>
          Analyze your project idea using AI. Discover market demand,
          competition, development difficulty, monetization opportunities,
          target users, and much more.
        </p>

        <div className="hero-actions">
          <Link to="/analyze" className="primary-button">
            Analyze Your Idea →
          </Link>

          <Link to="/dashboard" className="secondary-button">
            View Dashboard
          </Link>
        </div>

        <div className="example-box">
          <p className="example-label">TRY AN EXAMPLE</p>

          <div className="example-idea">
            "I want to build an AI-powered expense tracker."
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-heading">
          <p>POWERFUL AI ANALYSIS</p>
          <h2>Everything You Need Before You Build</h2>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Market Demand</h3>
            <p>
              Understand whether people actually need your product.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Competition</h3>
            <p>
              Discover existing competitors and market opportunities.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Monetization</h3>
            <p>
              Explore subscriptions, SaaS, B2B, and other revenue models.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Target Users</h3>
            <p>
              Find the audience most likely to use your product.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>Differentiation</h3>
            <p>
              Find unique opportunities that can make your idea stand out.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>MVP Roadmap</h3>
            <p>
              Get a clear recommendation for what to build first.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;