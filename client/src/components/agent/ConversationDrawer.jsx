import { useState } from "react";
import { Plus, Search, Bot, X } from "lucide-react";
import { useAgent } from "../../context/useAgent";
import Button from "../common/Button";

function ConversationDrawer({ onClose }) {
  const {
    conversations,
    conversationId,
    selectConversation,
    resetWorkspace,
    loadingAction,
  } = useAgent();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (id) => {
    selectConversation(id);
    if (onClose) onClose();
  };

  const handleNew = () => {
    resetWorkspace();
    if (onClose) onClose();
  };

  return (
    <aside
      style={{
        width: "280px",
        height: "100%",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Header & New Investigation Button */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Bot size={16} style={{ color: "var(--primary-light)" }} />
            <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
              Investigations
            </strong>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                color: "var(--text-muted)",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleNew}
          icon={<Plus size={15} />}
          style={{ width: "100%", justifyContent: "center" }}
        >
          New Investigation
        </Button>

        {/* Search input */}
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px 6px 30px",
              fontSize: "12px",
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {filteredConversations.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            {searchQuery ? "No matching investigations found" : "No previous investigations"}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv._id === conversationId;
            const updatedTime = conv.updatedAt || conv.createdAt;
            const formattedDate = updatedTime
              ? new Date(updatedTime).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "";

            return (
              <button
                key={conv._id}
                type="button"
                onClick={() => handleSelect(conv._id)}
                disabled={loadingAction === "loading_conversation"}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  border: `1px solid ${isActive ? "var(--border-default)" : "transparent"}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  cursor: "pointer",
                  transition: "var(--transition-fast)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? "#ffffff" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {conv.title || "Untitled Investigation"}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--primary-light)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span>{conv.status || "active"}</span>
                  <span>{formattedDate}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default ConversationDrawer;
