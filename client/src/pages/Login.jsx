import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Login() {
const navigate = useNavigate();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const handleSubmit = async (event) => {
event.preventDefault();


setLoading(true);
setError("");

try {
  const response = await api.post(
    "/auth/login",
    {
      email,
      password,
    }
  );

  localStorage.setItem(
    "token",
    response.data.token
  );

  localStorage.setItem(
    "user",
    JSON.stringify(response.data.user)
  );

  navigate("/dashboard");
} catch (error) {
  setError(
    error.response?.data?.message ||
      "Invalid email or password"
  );
} finally {
  setLoading(false);
}


};

return ( <div className="auth-page"> <div className="auth-card"> <div className="auth-header"> <Link to="/" className="auth-logo"> <span>✦</span>
IdeaReality </Link>


      <p className="auth-label">
        WELCOME BACK
      </p>

      <h1>Sign in to your account</h1>

      <p>
        Continue analyzing your ideas and
        discovering new opportunities.
      </p>
    </div>

    {error && (
      <div className="auth-error">
        {error}
      </div>
    )}

    <form
      className="auth-form"
      onSubmit={handleSubmit}
    >
      <div className="form-group">
        <label htmlFor="email">
          Email Address
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">
          Password
        </label>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Enter your password"
          required
        />
      </div>

      <div className="auth-options">
        <label className="remember-me">
          <input type="checkbox" />
          Remember me
        </label>

        <button
          type="button"
          className="forgot-password"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="auth-submit-button"
        disabled={loading}
      >
        {loading
          ? "Signing In..."
          : "Sign In →"}
      </button>
    </form>

    <p className="auth-footer">
      Don't have an account?{" "}
      <Link to="/register">
        Create one
      </Link>
    </p>
  </div>
</div>


);
}

export default Login;
