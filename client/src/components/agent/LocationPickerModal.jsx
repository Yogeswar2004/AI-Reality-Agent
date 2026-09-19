import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  Marker,
  Circle,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  MapPin,
  Crosshair,
  Compass,
  AlertCircle,
  Navigation,
  Check,
  RotateCcw,
} from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import {
  PRESET_METROS,
  DEFAULT_INVESTIGATION_RADIUS_METERS,
} from "./mapDarkStyles";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = Object.freeze({
  latitude: 16.5062,
  longitude: 80.648,
});

/**
 * Inner Map component that interacts with the google.maps.Map instance via useMap hook.
 */
function MapCanvas({
  centerCoords,
  onCenterChange,
  targetPreset,
  userLocation,
}) {
  const map = useMap();
  const isProgrammaticMoveRef = useRef(false);
  const isMountedSettledRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const lastCenterRef = useRef(null);

  // Pan map when preset changes
  useEffect(() => {
    if (!map || !targetPreset) return;
    const currentCenter = map.getCenter();
    const isAlreadyThere =
      currentCenter &&
      Math.abs(currentCenter.lat() - targetPreset.latitude) < 0.0001 &&
      Math.abs(currentCenter.lng() - targetPreset.longitude) < 0.0001;

    if (!isAlreadyThere) {
      isProgrammaticMoveRef.current = true;
      map.panTo({ lat: targetPreset.latitude, lng: targetPreset.longitude });
      map.setZoom(13);
    }
  }, [map, targetPreset]);

  // Pan map when user GPS location changes
  useEffect(() => {
    if (!map || !userLocation) return;
    isProgrammaticMoveRef.current = true;
    map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
    map.setZoom(15);
  }, [map, userLocation]);

  // Listen to user drag interactions on Google Maps
  useEffect(() => {
    if (!map) return;
    const dragStartListener = map.addListener("dragstart", () => {
      isUserInteractingRef.current = true;
      isProgrammaticMoveRef.current = false;
    });
    return () => {
      if (typeof google !== "undefined" && google?.maps?.event?.removeListener) {
        google.maps.event.removeListener(dragStartListener);
      }
    };
  }, [map]);

  const handleIdle = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    if (!center) return;

    const lat = Number(center.lat().toFixed(6));
    const lng = Number(center.lng().toFixed(6));

    // First idle event on initial mount: mark settled without invalidating preset label
    if (!isMountedSettledRef.current) {
      isMountedSettledRef.current = true;
      lastCenterRef.current = { latitude: lat, longitude: lng };
      return;
    }

    // Programmatic move (preset click or GPS pan): consume flag without invalidating label
    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      lastCenterRef.current = { latitude: lat, longitude: lng };
      return;
    }

    // Check if coordinates moved from last recorded center
    const prev = lastCenterRef.current;
    const hasMoved =
      !prev ||
      Math.abs(lat - prev.latitude) > 0.0001 ||
      Math.abs(lng - prev.longitude) > 0.0001;

    if (hasMoved || isUserInteractingRef.current) {
      isUserInteractingRef.current = false;
      lastCenterRef.current = { latitude: lat, longitude: lng };
      onCenterChange({ latitude: lat, longitude: lng }, true /* isManual */);
    }
  }, [map, onCenterChange]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        defaultCenter={{ lat: centerCoords.latitude, lng: centerCoords.longitude }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        onIdle={handleIdle}
        style={{ width: "100%", height: "100%", minHeight: "360px" }}
      >
        {/* Visual 3 km catchment radius around current coordinates */}
        <Circle
          center={{ lat: centerCoords.latitude, lng: centerCoords.longitude }}
          radius={DEFAULT_INVESTIGATION_RADIUS_METERS}
          strokeColor="#8b5cf6"
          strokeOpacity={0.85}
          strokeWeight={2}
          fillColor="#7c3aed"
          fillOpacity={0.12}
        />

        {/* Center pin marker */}
        <Marker
          position={{ lat: centerCoords.latitude, lng: centerCoords.longitude }}
        />
      </Map>

      {/* Reticle / Crosshair visual overlay */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "1.5px solid rgba(168, 85, 247, 0.8)",
            borderRadius: "50%",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              background: "#a855f7",
              borderRadius: "50%",
              boxShadow: "0 0 6px #a855f7",
            }}
          />
        </div>
      </div>

      {/* Catchment Radius Badge */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 10,
          background: "rgba(14, 14, 20, 0.88)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          fontWeight: "600",
          color: "var(--primary-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Compass size={13} />
        <span>3 km investigation catchment</span>
      </div>

      {/* Live coordinates floating badge */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          zIndex: 10,
          background: "rgba(10, 10, 15, 0.9)",
          backdropFilter: "blur(6px)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--text-primary)",
        }}
      >
        {Number(centerCoords?.latitude ?? DEFAULT_CENTER.latitude).toFixed(6)} · {Number(centerCoords?.longitude ?? DEFAULT_CENTER.longitude).toFixed(6)}
      </div>
    </div>
  );
}

/**
 * Fallback coordinate editor when Google Maps is disabled or fails to initialize.
 */
function ManualCoordinateFallback({
  coords,
  label,
  onChangeCoords,
  onChangeLabel,
  error,
}) {
  return (
    <div
      style={{
        padding: "20px",
        background: "var(--bg-surface-subtle)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 12px",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderRadius: "var(--radius-sm)",
          color: "var(--status-warning)",
          fontSize: "12px",
        }}
      >
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
        <div>
          <strong>Interactive Map Unavailable</strong>
          <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "11px" }}>
            Google Maps API key is not configured or failed to initialize. You can still confirm exact geographic coordinates manually.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
          Location Label (Optional City / District Name)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => onChangeLabel(e.target.value)}
          placeholder="e.g. Austin Downtown, TX"
          style={{
            width: "100%",
            background: "var(--bg-input)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
            Latitude (-90 to +90)
          </label>
          <input
            type="number"
            step="0.0001"
            value={coords.latitude}
            onChange={(e) =>
              onChangeCoords({ ...coords, latitude: parseFloat(e.target.value) || 0 })
            }
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
            Longitude (-180 to +180)
          </label>
          <input
            type="number"
            step="0.0001"
            value={coords.longitude}
            onChange={(e) =>
              onChangeCoords({ ...coords, longitude: parseFloat(e.target.value) || 0 })
            }
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--status-danger)", fontSize: "12px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Main Professional Geographic Location Picker Modal.
 */
export default function LocationPickerModal({
  isOpen,
  onClose,
  initialLocation = null,
  onConfirmLocation,
}) {
  // Parsed coordinate state
  const [coords, setCoords] = useState(() => {
    if (initialLocation && typeof initialLocation === "object") {
      const lat = Number(initialLocation.latitude);
      const lng = Number(initialLocation.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    return { ...DEFAULT_CENTER };
  });

  const [label, setLabel] = useState(() => {
    if (initialLocation && typeof initialLocation === "object") {
      return initialLocation.label || "";
    }
    if (typeof initialLocation === "string" && initialLocation.trim()) {
      return initialLocation.trim();
    }
    return "Vijayawada, India";
  });

  const [targetPreset, setTargetPreset] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapError, setMapError] = useState(false);

  // Synchronize when opening with new initialLocation
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage("");
    setTargetPreset(null);
    setUserLocation(null);

    if (initialLocation && typeof initialLocation === "object") {
      const lat = Number(initialLocation.latitude);
      const lng = Number(initialLocation.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoords({ latitude: lat, longitude: lng });
      }
      if (initialLocation.label) setLabel(initialLocation.label);
    } else if (typeof initialLocation === "string" && initialLocation.trim()) {
      setLabel(initialLocation.trim());
      // Check preset match for city string
      const matched = PRESET_METROS.find((p) =>
        initialLocation.toLowerCase().includes(p.label.split(",")[0].toLowerCase())
      );
      if (matched) {
        setCoords({ latitude: matched.latitude, longitude: matched.longitude });
      }
    } else if (!initialLocation) {
      setCoords({ ...DEFAULT_CENTER });
      setLabel("Vijayawada, India");
    }
  }, [isOpen, initialLocation]);

  // Handle GPS location click
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setErrorMessage("");
    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const gpsCoords = { latitude: lat, longitude: lng };
        setCoords(gpsCoords);
        setUserLocation(gpsCoords);
        setTargetPreset(null);
        setLabel(`Device Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      },
      (err) => {
        setGeoLoading(false);
        console.warn("Geolocation request failed:", err?.message);
        setErrorMessage(
          err.code === 1
            ? "Location permission was denied. Please allow location access or select on the map."
            : "Could not retrieve device location. Please pan the map manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle preset chip click
  const handleSelectPreset = (preset) => {
    setErrorMessage("");
    setLabel(preset.label);
    const newCoords = { latitude: preset.latitude, longitude: preset.longitude };
    setCoords(newCoords);
    setTargetPreset(newCoords);
    setUserLocation(null);
  };

  // Confirm selection
  const handleConfirm = () => {
    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErrorMessage("Latitude must be a valid number between -90 and 90.");
      return;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setErrorMessage("Longitude must be a valid number between -180 and 180.");
      return;
    }

    const resolvedLabel = label?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    onConfirmLocation({
      latitude: lat,
      longitude: lng,
      label: resolvedLabel,
    });

    onClose();
  };

  const hasApiKey = Boolean(GOOGLE_MAPS_API_KEY && !mapError);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Investigation Location"
      description="Position the target venture market under the crosshair. The agent will inspect local competitors and market sentiment within a 3 km catchment radius."
      maxWidth="780px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Preset Metro Chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Quick Hub Presets
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            {PRESET_METROS.map((preset) => {
              const isActive =
                label === preset.label &&
                Math.abs(coords.latitude - preset.latitude) < 0.01 &&
                Math.abs(coords.longitude - preset.longitude) < 0.01;

              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    background: isActive ? "var(--primary-subtle)" : "var(--bg-surface-subtle)",
                    border: `1px solid ${isActive ? "var(--border-active)" : "var(--border-default)"}`,
                    color: isActive ? "var(--primary-light)" : "var(--text-secondary)",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "12px",
                    fontWeight: isActive ? "600" : "500",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Container or Manual Fallback */}
        <div
          style={{
            height: "clamp(250px, 40vh, 380px)",
            width: "100%",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface-subtle)",
            position: "relative",
          }}
        >
          {hasApiKey ? (
            <APIProvider
              apiKey={GOOGLE_MAPS_API_KEY}
              onError={(err) => {
                console.warn("Google Maps failed to load, switching to manual fallback:", err);
                setMapError(true);
              }}
            >
              <MapCanvas
                centerCoords={coords}
                onCenterChange={(newCoords, isManual) => {
                  setCoords(newCoords);
                  if (isManual) {
                    const lat = newCoords.latitude;
                    const lng = newCoords.longitude;
                    setLabel(`Market Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                    setTargetPreset(null);
                    setUserLocation(null);
                  }
                }}
                targetPreset={targetPreset}
                userLocation={userLocation}
              />
            </APIProvider>
          ) : (
            <div style={{ height: "100%", overflowY: "auto" }}>
              <ManualCoordinateFallback
                coords={coords}
                label={label}
                onChangeCoords={setCoords}
                onChangeLabel={setLabel}
                error={errorMessage}
              />
            </div>
          )}
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--status-danger-bg)",
              border: "1px solid var(--status-danger-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--status-danger)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Controls Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            paddingTop: "6px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              loading={geoLoading}
              icon={<Navigation size={13} />}
            >
              Use My Current Location
            </Button>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              {Number(coords?.latitude ?? DEFAULT_CENTER.latitude).toFixed(6)}, {Number(coords?.longitude ?? DEFAULT_CENTER.longitude).toFixed(6)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirm}
              icon={<Check size={14} />}
            >
              Confirm Location
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
