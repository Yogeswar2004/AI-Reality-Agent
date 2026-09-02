import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AnalyzeIdea from "./pages/AnalyzeIdea";
import AnalysisResults from "./pages/AnalysisResults";
import MyIdeas from "./pages/MyIdeas";
import CompareIdeas from "./pages/CompareIdeas";

function App() {
  return (
    <> <Navbar />


      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/analyze"
            element={<AnalyzeIdea />}
          />

          <Route
            path="/analysis/:id"
            element={<AnalysisResults />}
          />
          <Route
            path="/analysis-results/:id"
            element={<AnalysisResults />}
          />

          <Route
            path="/my-ideas"
            element={<MyIdeas />}
          />

          <Route
            path="/compare"
            element={<CompareIdeas />}
          />
        </Route>
      </Routes>
    </>


  );
}

export default App;
