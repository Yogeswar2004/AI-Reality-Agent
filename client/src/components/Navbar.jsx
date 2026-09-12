import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  return (
    <nav style={styles.navbar}>
      <div style={styles.navContainer}>

        {/* ========================================
            LOGO
        ======================================== */}

        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>
            ✦
          </span>

          <span style={styles.logoText}>
            Idea<span style={styles.logoHighlight}>Reality</span>
          </span>
        </Link>

        {/* ========================================
            NAVIGATION
        ======================================== */}

        <div style={styles.navLinks}>

          {token ? (
            <>
              <Link
                to="/dashboard"
                style={styles.navLink}
              >
                Dashboard
              </Link>

              <Link
                to="/agent"
                style={styles.navLink}
              >
                AI Agent
              </Link>

              <Link
                to="/my-ideas"
                style={styles.navLink}
              >
                My Ideas
              </Link>

              <Link
                to="/compare"
                style={styles.navLink}
              >
                Compare
              </Link>

              <button
                type="button"
                style={styles.logoutButton}
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={styles.navLink}
              >
                Login
              </Link>

              <Link
                to="/register"
                style={styles.registerButton}
              >
                Get Started
              </Link>
            </>
          )}

        </div>
      </div>
    </nav>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = {
  navbar: {
    width: "100%",
    position: "sticky",
    top: 0,
    zIndex: 1000,

    background:
      "rgba(10, 7, 24, 0.92)",

    backdropFilter:
      "blur(18px)",

    WebkitBackdropFilter:
      "blur(18px)",

    borderBottom:
      "1px solid rgba(139, 92, 246, 0.18)",

    boxSizing: "border-box",
  },

  navContainer: {
    width: "100%",
    maxWidth: "1250px",
    margin: "0 auto",

    minHeight: "72px",

    padding:
      "0 24px",

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    gap: "30px",

    boxSizing: "border-box",
  },

  /* ========================================
     LOGO
  ======================================== */

  logo: {
    display: "flex",
    alignItems: "center",

    gap: "10px",

    textDecoration: "none",

    color: "#ffffff",

    flexShrink: 0,
  },

  logoIcon: {
    width: "38px",
    height: "38px",

    borderRadius: "11px",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background:
      "linear-gradient(135deg, #7c3aed, #a855f7)",

    color: "#ffffff",

    fontSize: "22px",
    fontWeight: "700",

    boxShadow:
      "0 8px 25px rgba(124, 58, 237, 0.35)",
  },

  logoText: {
    fontSize: "20px",
    fontWeight: "800",
    letterSpacing: "-0.5px",
    color: "#ffffff",
  },

  logoHighlight: {
    color: "#a78bfa",
  },

  /* ========================================
     NAV LINKS
  ======================================== */

  navLinks: {
    display: "flex",
    alignItems: "center",

    gap: "8px",

    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  navLink: {
    textDecoration: "none",

    color: "#c4b5fd",

    fontSize: "14px",
    fontWeight: "600",

    padding:
      "10px 13px",

    borderRadius: "9px",

    transition:
      "background 0.2s ease, color 0.2s ease",

    whiteSpace: "nowrap",
  },

  /* ========================================
     GET STARTED
  ======================================== */

  registerButton: {
    textDecoration: "none",

    color: "#ffffff",

    fontSize: "14px",
    fontWeight: "700",

    padding:
      "11px 18px",

    borderRadius: "10px",

    background:
      "linear-gradient(135deg, #7c3aed, #9333ea)",

    border:
      "1px solid rgba(167, 139, 250, 0.4)",

    boxShadow:
      "0 8px 22px rgba(124, 58, 237, 0.28)",

    whiteSpace: "nowrap",
  },

  /* ========================================
     LOGOUT
  ======================================== */

  logoutButton: {
    border:
      "1px solid rgba(248, 113, 113, 0.25)",

    background:
      "rgba(127, 29, 29, 0.18)",

    color: "#fca5a5",

    fontSize: "14px",
    fontWeight: "600",

    padding:
      "10px 15px",

    borderRadius: "9px",

    cursor: "pointer",

    whiteSpace: "nowrap",

    transition:
      "background 0.2s ease, border 0.2s ease",
  },
};

export default Navbar;