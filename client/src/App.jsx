import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Agent from "./pages/Agent";
import Dashboard from "./pages/Dashboard";
import MyIdeas from "./pages/MyIdeas";
import CompareIdeas from "./pages/CompareIdeas";
import Profile from "./pages/Profile";
import AnalyzeIdea from "./pages/AnalyzeIdea";
import AnalysisResults from "./pages/AnalysisResults";

function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/agent" element={<Agent />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-ideas" element={<MyIdeas />} />
            <Route path="/compare" element={<CompareIdeas />} />
            <Route path="/profile" element={<Profile />} />

            {/* Legacy Reality Analyzer Routes (Redirected to Agent Studio) */}
            <Route path="/analyze" element={<Navigate to="/agent" replace />} />
            <Route path="/analysis/:id" element={<AnalysisResults />} />
            <Route path="/analysis-results/:id" element={<AnalysisResults />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthProvider>
  );
}

export default App;
