import { useContext } from "react";
import { AgentContext } from "./agentContextInstance";

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
};

export default useAgent;

