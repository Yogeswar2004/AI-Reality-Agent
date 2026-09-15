import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import Spinner from "../common/Spinner";

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app)",
        }}
      >
        <Spinner size={28} color="var(--primary-light)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
