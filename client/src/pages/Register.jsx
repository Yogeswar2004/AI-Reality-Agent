import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Sparkles, User, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Card from "../components/common/Card";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await register({ name, email, password });
      navigate("/agent");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <Card variant="elevated" padding="lg">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-gradient)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "var(--shadow-glow)",
                marginBottom: "12px",
              }}
            >
              <Sparkles size={20} />
            </div>

            <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
              Create your account
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Start analyzing your startup and business ideas with AI agent intelligence.
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--status-danger-bg)",
                border: "1px solid var(--status-danger-border)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--status-danger)",
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Input
              label="Full Name"
              type="text"
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User size={15} />}
              required
              disabled={loading}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={15} />}
              required
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={15} />}
              required
              disabled={loading}
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={<ArrowRight size={15} />}
              iconPosition="right"
              style={{ width: "100%", justifyContent: "center", marginTop: "4px" }}
            >
              Create Account
            </Button>
          </form>

          <div
            style={{
              marginTop: "20px",
              textAlign: "center",
              fontSize: "13px",
              color: "var(--text-muted)",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--primary-light)", fontWeight: "600" }}>
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Register;
