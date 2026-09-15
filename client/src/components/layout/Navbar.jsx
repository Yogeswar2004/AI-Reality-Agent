import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { Sparkles, Bot, LayoutDashboard, Lightbulb, GitCompare, User, LogOut, Menu, X } from "lucide-react";
import Button from "../common/Button";

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkStyle = ({ isActive }) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
    fontWeight: "600",
    color: isActive ? "#ffffff" : "var(--text-secondary)",
    background: isActive ? "rgba(255, 255, 255, 0.08)" : "transparent",
    transition: "var(--transition-fast)",
  });

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "56px",
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        {/* Left: Brand Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "800",
              fontSize: "16px",
              letterSpacing: "-0.5px",
              color: "#ffffff",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px var(--primary-glow)",
              }}
            >
              <Sparkles size={16} />
            </div>
            <span>
              Idea<span style={{ color: "var(--primary-light)" }}>Reality</span>
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "1px",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                background: "var(--primary-subtle)",
                color: "var(--primary-light)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
              }}
            >
              Agent
            </span>
          </Link>

          {/* Desktop Nav Links */}
          {isAuthenticated && (
            <nav style={{ display: "flex", alignItems: "center", gap: "4px" }} className="desktop-nav">
              <NavLink to="/agent" style={navLinkStyle}>
                <Bot size={15} />
                <span>Agent Studio</span>
              </NavLink>

              <NavLink to="/dashboard" style={navLinkStyle}>
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/my-ideas" style={navLinkStyle}>
                <Lightbulb size={15} />
                <span>My Ideas</span>
              </NavLink>

              <NavLink to="/compare" style={navLinkStyle}>
                <GitCompare size={15} />
                <span>Compare</span>
              </NavLink>
            </nav>
          )}
        </div>

        {/* Right: Auth Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Link
                to="/profile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(124, 58, 237, 0.2)",
                    color: "var(--primary-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: "700",
                  }}
                >
                  <User size={12} />
                </div>
                <span className="user-name-text">{user?.name || "Account"}</span>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                icon={<LogOut size={14} />}
                style={{ color: "var(--text-muted)", padding: "6px 10px" }}
                title="Log out"
              >
                <span className="logout-text">Logout</span>
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger toggle */}
          {isAuthenticated && (
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                color: "var(--text-secondary)",
                padding: "6px",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && isAuthenticated && (
        <div
          style={{
            position: "absolute",
            top: "56px",
            left: 0,
            right: 0,
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-default)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 99,
          }}
        >
          <NavLink
            to="/agent"
            style={navLinkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Bot size={16} />
            <span>Agent Studio</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            style={navLinkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/my-ideas"
            style={navLinkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Lightbulb size={16} />
            <span>My Ideas</span>
          </NavLink>

          <NavLink
            to="/compare"
            style={navLinkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            <GitCompare size={16} />
            <span>Compare</span>
          </NavLink>

          <NavLink
            to="/profile"
            style={navLinkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            <User size={16} />
            <span>Profile</span>
          </NavLink>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--status-danger)",
              marginTop: "8px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav, .user-name-text, .logout-text {
            display: none !important;
          }
          .mobile-menu-toggle {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}

export default Navbar;
