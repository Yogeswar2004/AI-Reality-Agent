import { useState } from "react";
import api from "../api/api";

function Agent() {
  const [goal, setGoal] = useState("");
  const [location, setLocation] = useState("");
  const [run, setRun] = useState(null);
  const [validNextStates, setValidNextStates] = useState([]);
  const [nextState, setNextState] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setRun(null);
    setValidNextStates([]);
    setNextState("");

    if (!goal.trim()) {
      setError("Please describe the goal you want the agent to investigate.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/agent/runs", {
        goal: goal.trim(),
        location: location.trim() || null,
      });

      setRun(response.data.run);
      setValidNextStates(response.data.validNextStates || []);
      setNextState(response.data.validNextStates?.[0] || "");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to create an agent run"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (event) => {
    event.preventDefault();

    if (!run || !nextState) {
      return;
    }

    try {
      setTransitioning(true);
      setError("");

      const response = await api.patch(
        `/agent/runs/${run._id}/state`,
        { state: nextState }
      );

      const nextValidStates = response.data.validNextStates || [];

      setRun(response.data.run);
      setValidNextStates(nextValidStates);
      setNextState(nextValidStates[0] || "");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to update the agent run state"
      );
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <main className="agent-page">
      <section className="agent-card">
        <p className="agent-eyebrow">AGENT FOUNDATION</p>
        <h1>AI Reality Agent</h1>
        <p className="agent-description">
          Describe a project or business idea. The agent will eventually
          investigate it using controlled research tools and evidence.
        </p>

        <form onSubmit={handleSubmit} className="agent-form">
          <label htmlFor="agent-goal">Your goal</label>
          <textarea
            id="agent-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Example: Evaluate whether a premium bike repair shop is viable."
            rows="6"
            required
          />

          <label htmlFor="agent-location">Location (optional)</label>
          <input
            id="agent-location"
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Example: Vijayawada, Andhra Pradesh"
          />

          {error && <p className="agent-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Starting..." : "Start Agent"}
          </button>
        </form>

        {run && (
          <section className="agent-run-status" aria-live="polite">
            <h2>Run created</h2>
            <p>Current state: <strong>{run.state}</strong></p>
            <p>Run ID: {run._id}</p>

            {validNextStates.length > 0 ? (
              <form onSubmit={handleTransition}>
                <label htmlFor="agent-next-state">
                  Development lifecycle transition
                </label>
                <select
                  id="agent-next-state"
                  value={nextState}
                  onChange={(event) => setNextState(event.target.value)}
                >
                  {validNextStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={transitioning}>
                  {transitioning ? "Updating..." : "Transition State"}
                </button>
              </form>
            ) : (
              <p>This run is in a terminal state.</p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default Agent;
