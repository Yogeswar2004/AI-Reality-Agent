import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Register() {
const navigate = useNavigate();

const [name, setName] = useState("");
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
    "/auth/register",
    {
      name,
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
      "Failed to create account"
  );
} finally {
  setLoading(false);
}


};

return ( <div className="auth-page"> <div className="auth-card"> <div className="auth-header"> <Link to="/" className="auth-logo"> <span>✦</span>
IdeaReality </Link>


      <p className="auth-label">
        GET STARTED
      </p>

      <h1>Create your account</h1>

      <p>
        Start analyzing your startup ideas and
        discovering real opportunities.
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
        <label htmlFor="name">
          Full Name
        </label>

        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="Your full name"
          required
        />
      </div>

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
          placeholder="Create a strong password"
          required
        />
      </div>

      <label className="terms-checkbox">
        <input type="checkbox" required />

        <span>
          I agree to the Terms of Service and
          Privacy Policy.
        </span>
      </label>

      <button
        type="submit"
        className="auth-submit-button"
        disabled={loading}
      >
        {loading
          ? "Creating Account..."
          : "Create Account →"}
      </button>
    </form>

    <p className="auth-footer">
      Already have an account?{" "}
      <Link to="/login">
        Sign in
      </Link>
    </p>
  </div>
</div>


);
}

export default Register;
