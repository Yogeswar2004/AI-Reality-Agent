import { useState } from "react";
import { AgentProvider } from "../context/AgentContext";
import { useAgent } from "../context/useAgent";
import ConversationDrawer from "../components/agent/ConversationDrawer";
import ConversationFeed from "../components/agent/ConversationFeed";
import RunInspector from "../components/agent/RunInspector";
import { MessageSquare, Activity, Menu, PanelLeft, PanelRight } from "lucide-react";

function AgentWorkspace() {
  const {
    drawerOpen,
    setDrawerOpen,
    mobileTab,
    setMobileTab,
    run,
  } = useAgent();

  const [inspectorOpen, setInspectorOpen] = useState(true);

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 56px)",
        width: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ==================== LEFT DRAWER (DESKTOP) ==================== */}
      <div className={`desktop-drawer ${drawerOpen ? "open" : "collapsed"}`}>
        {drawerOpen && <ConversationDrawer />}
      </div>

      {/* ==================== LEFT DRAWER (MOBILE OVERLAY) ==================== */}
      {mobileTab === "history" && (
        <div className="mobile-drawer-overlay">
          <div className="mobile-drawer-inner">
            <ConversationDrawer onClose={() => setMobileTab("chat")} />
          </div>
        </div>
      )}

      {/* ==================== CENTER WORKSPACE ==================== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minWidth: 0,
        }}
        className={mobileTab !== "chat" ? "mobile-hidden" : ""}
      >
        {/* Workspace Top Toolbar */}
        <div
          style={{
            height: "42px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="drawer-toggle-btn"
              style={{
                color: "var(--text-muted)",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: "var(--radius-xs)",
              }}
              title={drawerOpen ? "Collapse history" : "Expand history"}
            >
              <PanelLeft size={16} />
            </button>

            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>
              {run?.goal ? run.goal.slice(0, 48) + "..." : "Investigation Workspace"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setInspectorOpen(!inspectorOpen)}
              className="inspector-toggle-btn"
              style={{
                color: inspectorOpen ? "var(--primary-light)" : "var(--text-muted)",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                borderRadius: "var(--radius-xs)",
                fontSize: "12px",
                fontWeight: "600",
              }}
              title={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
            >
              <PanelRight size={16} />
              <span className="toggle-label">Inspector</span>
            </button>
          </div>
        </div>

        <ConversationFeed />
      </div>

      {/* ==================== RIGHT INSPECTOR ==================== */}
      <div
        className={`inspector-pane ${inspectorOpen ? "open" : "collapsed"} ${
          mobileTab !== "inspector" ? "mobile-hidden" : ""
        }`}
      >
        <RunInspector />
      </div>

      {/* ==================== MOBILE NAVIGATION BAR ==================== */}
      <div className="mobile-bottom-bar">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "history" ? "active" : ""}`}
          onClick={() => setMobileTab("history")}
        >
          <Menu size={18} />
          <span>History</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "chat" ? "active" : ""}`}
          onClick={() => setMobileTab("chat")}
        >
          <MessageSquare size={18} />
          <span>Chat</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "inspector" ? "active" : ""}`}
          onClick={() => setMobileTab("inspector")}
        >
          <Activity size={18} />
          <span>Inspector</span>
        </button>
      </div>

      <style>{`
        /* Desktop Drawer */
        .desktop-drawer {
          height: 100%;
          transition: width 0.2s ease;
        }
        .desktop-drawer.open {
          width: 280px;
        }
        .desktop-drawer.collapsed {
          width: 0;
          overflow: hidden;
        }

        /* Inspector Pane */
        .inspector-pane {
          width: 380px;
          height: 100%;
          flex-shrink: 0;
          transition: width 0.2s ease;
        }
        .inspector-pane.collapsed {
          width: 0;
          overflow: hidden;
        }

        /* Mobile Layout */
        .mobile-bottom-bar {
          display: none;
        }
        .mobile-drawer-overlay {
          display: none;
        }

        @media (max-width: 1024px) {
          .inspector-pane {
            width: 320px;
          }
        }

        @media (max-width: 768px) {
          .desktop-drawer {
            display: none !important;
          }
          .drawer-toggle-btn {
            display: none !important;
          }
          .inspector-toggle-btn {
            display: none !important;
          }

          .inspector-pane {
            width: 100% !important;
            flex: 1;
            height: calc(100% - 56px);
          }

          .mobile-hidden {
            display: none !important;
          }

          /* Mobile Bottom Navigation */
          .mobile-bottom-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: var(--bg-surface);
            border-top: 1px solid var(--border-default);
            z-index: 90;
          }

          .mobile-tab-btn {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justifyContent: center;
            gap: 2px;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 600;
          }
          .mobile-tab-btn.active {
            color: var(--primary-light);
          }

          /* Fullscreen Mobile Drawer Overlay */
          .mobile-drawer-overlay {
            display: flex;
            position: fixed;
            inset: 0;
            z-index: 150;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
          }
          .mobile-drawer-inner {
            width: 85%;
            max-width: 320px;
            height: 100%;
            background: var(--bg-surface);
          }
        }
      `}</style>
    </div>
  );
}

function Agent() {
  return (
    <AgentProvider>
      <AgentWorkspace />
    </AgentProvider>
  );
}

export default Agent;
