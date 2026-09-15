import { useAuth } from "../context/useAuth";
import { Mail, LogOut, Bot, Sparkles } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Link, useNavigate } from "react-router-dom";

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px 80px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--primary-light)",
            display: "block",
            marginBottom: "4px",
          }}
        >
          User Account
        </span>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px", margin: 0 }}>
          Profile & Preferences
        </h1>
      </div>

      <Card variant="elevated" padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "var(--radius-full)",
              background: "var(--primary-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "700",
              color: "#ffffff",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : "U"}
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "750", color: "var(--text-primary)", margin: 0 }}>
                {user?.name || "Reality Explorer"}
              </h2>
              <Badge variant="primary" size="xs">
                Active Member
              </Badge>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", color: "var(--text-secondary)", fontSize: "13px" }}>
              <Mail size={14} style={{ color: "var(--text-muted)" }} />
              <span>{user?.email || "No email on record"}</span>
            </div>
          </div>

          <Button variant="danger" size="sm" onClick={handleLogout} icon={<LogOut size={14} />}>
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Workspace Quick Launch */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        <Link to="/agent">
          <Card variant="interactive" padding="md" style={{ height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "var(--primary-subtle)", color: "var(--primary-light)" }}>
                <Bot size={18} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>AI Agent Studio</strong>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              Launch autonomous venture investigations, inspect grounded market evidence, and view synthesized viability verdicts.
            </p>
          </Card>
        </Link>

        <Link to="/dashboard">
          <Card variant="interactive" padding="md" style={{ height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(59, 130, 246, 0.15)", color: "var(--status-info)" }}>
                <Sparkles size={18} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Dashboard Overview</strong>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              Review your saved ventures, idea feasibility comparisons, and historic analysis scores.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default Profile;