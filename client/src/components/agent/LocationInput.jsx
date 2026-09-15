import React, { useState } from "react";
import { MapPin, Map as MapIcon, X, Edit3, Compass } from "lucide-react";
import Button from "../common/Button";
import LocationPickerModal from "./LocationPickerModal";

/**
 * Smart Geographic Location Input for AI Reality Agent setup.
 * Supports both manual text entry and professional map-based structured selection.
 */
export default function LocationInput({
  location,
  onChange,
  disabled = false,
}) {
  const [modalOpen, setModalOpen] = useState(false);

  // Check if current location is a confirmed structured location object
  const isStructured =
    Boolean(location) &&
    typeof location === "object" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number";

  // Raw text representation if location is a plain string
  const stringValue = typeof location === "string" ? location : "";

  // Handle text input change
  const handleTextChange = (e) => {
    onChange(e.target.value);
  };

  // Handle map confirmation
  const handleConfirmLocation = (confirmedCoords) => {
    onChange(confirmedCoords);
  };

  // Clear structured location back to empty text
  const handleClear = () => {
    onChange("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
        Geographic Location{" "}
        <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>
          (Required for local business tools)
        </span>
      </label>

      {isStructured ? (
        /* Mode B: Confirmed Structured Location Card */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface-subtle)",
            border: "1px solid var(--border-active)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            gap: "12px",
            boxShadow: "0 0 15px rgba(124, 58, 237, 0.08)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-subtle)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary-light)",
                flexShrink: 0,
              }}
            >
              <MapPin size={16} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {location.label || "Custom Market Coordinates"}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  marginTop: "2px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
                </span>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    color: "var(--primary-light)",
                    fontWeight: "500",
                  }}
                >
                  <Compass size={11} />
                  3 km catchment
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModalOpen(true)}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 9px",
                fontSize: "11px",
                fontWeight: "500",
                color: "var(--text-secondary)",
                cursor: disabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <Edit3 size={11} />
              <span>Change</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              title="Clear location"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "5px",
                color: "var(--text-muted)",
                cursor: disabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.color = "var(--status-danger)";
              }}
              onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* Mode A: Manual / Unselected text input with Map trigger */
        <div style={{ position: "relative", width: "100%" }}>
          <MapPin
            size={14}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />

          <input
            type="text"
            value={stringValue}
            onChange={handleTextChange}
            placeholder="e.g. Portland, OR or Austin, TX (or pick on map)"
            disabled={disabled}
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "10px 105px 10px 36px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--border-active)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-default)";
            }}
          />

          <button
            type="button"
            disabled={disabled}
            onClick={() => setModalOpen(true)}
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--primary-subtle)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 9px",
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--primary-light)",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = "rgba(124, 58, 237, 0.22)";
                e.currentTarget.style.borderColor = "var(--primary-light)";
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = "var(--primary-subtle)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              }
            }}
          >
            <MapIcon size={12} />
            <span>Pick on Map</span>
          </button>
        </div>
      )}

      {/* Interactive Location Picker Modal */}
      {modalOpen && (
        <LocationPickerModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialLocation={location}
          onConfirmLocation={handleConfirmLocation}
        />
      )}
    </div>
  );
}
