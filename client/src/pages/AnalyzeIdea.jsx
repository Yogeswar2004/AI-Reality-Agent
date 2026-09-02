import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  APIProvider,
  Map,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";

const API_URL = "http://localhost:5000/api";

const DEFAULT_CENTER = {
  lat: 16.5062,
  lng: 80.648,
};

const DEFAULT_ZOOM = 13;

/* ========================================
   MAP PICKER
======================================== */

const MapPicker = ({
  selectedLocation,
  setSelectedLocation,
}) => {
  const map = useMap();

  const [centerLocation, setCenterLocation] =
    useState(null);

  /* ----------------------------------------
     Get coordinates from map center
  ---------------------------------------- */

  const updateCenterLocation = () => {
    if (!map) return;

    const center = map.getCenter();

    if (!center) return;

    setCenterLocation({
      latitude: center.lat(),
      longitude: center.lng(),
    });
  };

  /* ----------------------------------------
     Confirm center location
  ---------------------------------------- */

  const handleUseLocation = () => {
    if (!map) return;

    const center = map.getCenter();

    if (!center) return;

    const latitude = center.lat();
    const longitude = center.lng();

    setSelectedLocation({
      latitude,
      longitude,
    });

    setCenterLocation({
      latitude,
      longitude,
    });
  };

  /* ----------------------------------------
     Use current device location
  ---------------------------------------- */

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        if (map) {
          map.panTo({
            lat: latitude,
            lng: longitude,
          });

          map.setZoom(16);
        }

        setSelectedLocation({
          latitude,
          longitude,
        });

        setCenterLocation({
          latitude,
          longitude,
        });
      },
      (error) => {
        console.error(
          "Location error:",
          error
        );

        alert(
          "Unable to get your current location. Please allow location access or select the location manually."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div style={styles.mapWrapper}>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={styles.map}
        onIdle={updateCenterLocation}
      >
        {selectedLocation && (
          <Marker
            position={{
              lat: selectedLocation.latitude,
              lng: selectedLocation.longitude,
            }}
          />
        )}
      </Map>

      {/* CENTER TARGET */}

      <div style={styles.centerTarget}>
        <div style={styles.targetOuter}>
          <div style={styles.targetInner} />
        </div>
      </div>

      {/* MAP INSTRUCTION */}

      <div style={styles.mapInstruction}>
        <div style={styles.mapInstructionTitle}>
          Move the map to choose a location
        </div>

        <div style={styles.mapInstructionText}>
          Position your desired location under
          the center marker.
        </div>
      </div>

      {/* MAP CONTROLS */}

      <div style={styles.mapControls}>
        <button
          type="button"
          style={styles.currentLocationButton}
          onClick={handleCurrentLocation}
        >
          <span style={styles.buttonIcon}>
            📍
          </span>

          <span>
            Use My Current Location
          </span>
        </button>

        <button
          type="button"
          style={styles.useLocationButton}
          onClick={handleUseLocation}
        >
          <span style={styles.buttonIcon}>
            ✓
          </span>

          <span>
            Use This Location
          </span>
        </button>
      </div>

      {/* CURRENT CENTER COORDINATES */}

      {centerLocation && (
        <div style={styles.centerCoordinates}>
          <span>
            {centerLocation.latitude.toFixed(6)}
          </span>

          <span style={styles.coordinateDivider}>
            •
          </span>

          <span>
            {centerLocation.longitude.toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
};

/* ========================================
   ANALYZE IDEA
======================================== */

const AnalyzeIdea = () => {
  const navigate = useNavigate();

  const [analysisMode, setAnalysisMode] =
    useState("tech");

  const [title, setTitle] = useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("General");

  const [businessType, setBusinessType] =
    useState("");

  const [selectedLocation, setSelectedLocation] =
    useState(null);

  const [searchRadius, setSearchRadius] =
    useState(3000);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const token =
    localStorage.getItem("token");

  /* ========================================
     SUBMIT IDEA
  ======================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!title.trim()) {
      setError(
        "Please enter your idea or business name"
      );
      return;
    }

    if (!description.trim()) {
      setError(
        "Please enter a description"
      );
      return;
    }

    if (
      analysisMode === "local" &&
      !businessType.trim()
    ) {
      setError(
        "Please enter the business type"
      );
      return;
    }

    if (
      analysisMode === "local" &&
      !selectedLocation
    ) {
      setError(
        "Please select a location on the map"
      );
      return;
    }

    try {
      setLoading(true);

      const ideaData = {
        title: title.trim(),

        description: description.trim(),

        category:
          analysisMode === "tech"
            ? category
            : businessType.trim(),

        analysisMode,

        businessType:
          analysisMode === "local"
            ? businessType.trim()
            : null,

        location:
          analysisMode === "local"
            ? selectedLocation
            : null,

        searchRadius:
          analysisMode === "local"
            ? Number(searchRadius)
            : null,
      };

      const response =
        await axios.post(
          `${API_URL}/ideas`,
          ideaData,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const ideaId =
        response.data.idea.id;

      navigate(
        `/analysis-results/${ideaId}`
      );
    } catch (error) {
      console.error(
        "Failed to save idea:",
        error
      );

      setError(
        error.response?.data?.message ||
        "Failed to save your idea"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <main style={styles.container}>

        {/* ========================================
            HEADER
        ======================================== */}

        <header style={styles.header}>
          <div style={styles.eyebrow}>
            IDEA ANALYZER
          </div>

          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>
                Analyze your idea
              </h1>

              <p style={styles.subtitle}>
                Discover whether your idea has
                real-world potential before you
                invest your time and money.
              </p>
            </div>
          </div>
        </header>

        {/* ========================================
            MAIN FORM CARD
        ======================================== */}

        <section style={styles.mainCard}>

          {/* ========================================
              ANALYSIS MODE
          ======================================== */}

          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionNumber}>
                  01
                </div>

                <h2 style={styles.sectionTitle}>
                  What do you want to analyze?
                </h2>

                <p style={styles.sectionDescription}>
                  Choose the type of idea you want
                  Reality Analyzer to evaluate.
                </p>
              </div>
            </div>

            <div style={styles.modeGrid}>

              {/* TECH */}

              <button
                type="button"
                style={{
                  ...styles.modeCard,
                  ...(analysisMode === "tech"
                    ? styles.activeMode
                    : {}),
                }}
                onClick={() => {
                  setAnalysisMode("tech");

                  setBusinessType("");

                  setSelectedLocation(null);
                }}
              >
                <div
                  style={{
                    ...styles.modeIconBox,
                    ...(analysisMode === "tech"
                      ? styles.activeIconBox
                      : {}),
                  }}
                >
                  💻
                </div>

                <div style={styles.modeContent}>
                  <div style={styles.modeTitleRow}>
                    <h3 style={styles.modeTitle}>
                      Tech Project
                    </h3>

                    {analysisMode === "tech" && (
                      <span style={styles.selectedBadge}>
                        Selected
                      </span>
                    )}
                  </div>

                  <p style={styles.modeText}>
                    Analyze SaaS products,
                    websites, mobile apps,
                    AI tools and software
                    startups.
                  </p>

                  <div style={styles.modeExamples}>
                    AI · SaaS · Mobile · Web
                  </div>
                </div>
              </button>

              {/* LOCAL */}

              <button
                type="button"
                style={{
                  ...styles.modeCard,
                  ...(analysisMode === "local"
                    ? styles.activeMode
                    : {}),
                }}
                onClick={() => {
                  setAnalysisMode("local");

                  setCategory(
                    "Local Business"
                  );
                }}
              >
                <div
                  style={{
                    ...styles.modeIconBox,
                    ...(analysisMode === "local"
                      ? styles.activeIconBox
                      : {}),
                  }}
                >
                  🏪
                </div>

                <div style={styles.modeContent}>
                  <div style={styles.modeTitleRow}>
                    <h3 style={styles.modeTitle}>
                      Local Business
                    </h3>

                    {analysisMode === "local" && (
                      <span style={styles.selectedBadge}>
                        Selected
                      </span>
                    )}
                  </div>

                  <p style={styles.modeText}>
                    Analyze shops, salons,
                    restaurants, repair businesses,
                    food courts and more.
                  </p>

                  <div style={styles.modeExamples}>
                    Shops · Salons · Restaurants
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div style={styles.divider} />

          {/* ========================================
              BASIC INFORMATION
          ======================================== */}

          <div style={styles.section}>

            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                02
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Tell us about your idea
                </h2>

                <p style={styles.sectionDescription}>
                  Give us enough context to produce
                  a useful analysis.
                </p>
              </div>
            </div>

            {/* IDEA NAME */}

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {analysisMode === "tech"
                  ? "Project Idea"
                  : "Business Idea"}

                <span style={styles.required}>
                  *
                </span>
              </label>

              <input
                type="text"
                placeholder={
                  analysisMode === "tech"
                    ? "Example: AI-powered expense tracker"
                    : "Example: Premium bike repair shop"
                }
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                style={styles.input}
              />
            </div>

            {/* BUSINESS TYPE */}

            {analysisMode === "local" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Business Type

                  <span style={styles.required}>
                    *
                  </span>
                </label>

                <input
                  type="text"
                  placeholder="Example: Bike Repair Shop, Salon, Food Court"
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <p style={styles.helpText}>
                  Describe the type of business
                  you want to start.
                </p>
              </div>
            )}

            {/* TECH CATEGORY */}

            {analysisMode === "tech" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Project Category
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option value="General">
                    General
                  </option>

                  <option value="AI">
                    AI
                  </option>

                  <option value="SaaS">
                    SaaS
                  </option>

                  <option value="Mobile App">
                    Mobile App
                  </option>

                  <option value="Web Application">
                    Web Application
                  </option>

                  <option value="FinTech">
                    FinTech
                  </option>

                  <option value="HealthTech">
                    HealthTech
                  </option>

                  <option value="EdTech">
                    EdTech
                  </option>

                  <option value="E-commerce">
                    E-commerce
                  </option>
                </select>
              </div>
            )}

            {/* DESCRIPTION */}

            <div style={styles.formGroup}>
              <div style={styles.labelRow}>
                <label style={styles.label}>
                  {analysisMode === "tech"
                    ? "Project Description"
                    : "Business Description"}

                  <span style={styles.required}>
                    *
                  </span>
                </label>

                <span style={styles.optionalHint}>
                  Be specific
                </span>
              </div>

              <textarea
                placeholder={
                  analysisMode === "tech"
                    ? "Describe what you want to build, who will use it and what problem it solves..."
                    : "Describe your business, products or services, target customers and what makes it different..."
                }
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                style={styles.textarea}
              />

              <p style={styles.helpText}>
                The more context you provide,
                the more useful your analysis
                will be.
              </p>
            </div>
          </div>

          {/* ========================================
              LOCAL BUSINESS SECTION
          ======================================== */}

          {analysisMode === "local" && (
            <>
              <div style={styles.divider} />

              <div style={styles.section}>

                <div style={styles.sectionHeader}>
                  <div style={styles.sectionNumber}>
                    03
                  </div>

                  <div>
                    <h2 style={styles.sectionTitle}>
                      Define your local market
                    </h2>

                    <p style={styles.sectionDescription}>
                      Select the location where you
                      plan to operate your business,
                      and click use this location or
                      use current location.
                    </p>
                  </div>
                </div>

                {/* MAP */}

                <div style={styles.formGroup}>

                  <label style={styles.label}>
                    📍 Business Location

                    <span style={styles.required}>
                      *
                    </span>
                  </label>

                  <p style={styles.helpText}>
                    Move the map until your desired
                    location is underneath the
                    center marker.
                  </p>

                  <div style={styles.mapContainer}>
                    <APIProvider
                      apiKey={
                        import.meta.env
                          .VITE_GOOGLE_MAPS_API_KEY
                      }
                    >
                      <MapPicker
                        selectedLocation={
                          selectedLocation
                        }
                        setSelectedLocation={
                          setSelectedLocation
                        }
                      />
                    </APIProvider>
                  </div>

                  {/* SELECTED LOCATION */}

                  {selectedLocation && (
                    <div
                      style={
                        styles.selectedLocation
                      }
                    >
                      <div
                        style={
                          styles.locationSuccessIcon
                        }
                      >
                        ✓
                      </div>

                      <div
                        style={
                          styles.locationSuccessContent
                        }
                      >
                        <strong
                          style={
                            styles.locationSuccessTitle
                          }
                        >
                          Location selected
                        </strong>

                        <div
                          style={
                            styles.coordinates
                          }
                        >
                          <span>
                            Lat:{" "}
                            {selectedLocation.latitude.toFixed(
                              6
                            )}
                          </span>

                          <span>
                            Lng:{" "}
                            {selectedLocation.longitude.toFixed(
                              6
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SEARCH RADIUS */}

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Competition Search Radius
                  </label>

                  <select
                    value={searchRadius}
                    onChange={(e) =>
                      setSearchRadius(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    style={styles.input}
                  >
                    <option value={1000}>
                      1 km
                    </option>

                    <option value={3000}>
                      3 km
                    </option>

                    <option value={5000}>
                      5 km
                    </option>

                    <option value={10000}>
                      10 km
                    </option>
                  </select>

                  <p style={styles.helpText}>
                    We'll search for similar
                    businesses within this
                    distance.
                  </p>
                </div>

                {/* INFO BOX */}

                <div style={styles.infoBox}>
                  <div style={styles.infoIcon}>
                    ✦
                  </div>

                  <div>
                    <h3 style={styles.infoTitle}>
                      Local Market Analysis
                    </h3>

                    <p style={styles.infoText}>
                      Your selected location and
                      search radius will be used
                      to identify nearby competitors,
                      analyze customer reviews,
                      and evaluate the local
                      opportunity.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================
              ERROR
          ======================================== */}

          {error && (
            <div style={styles.error}>
              <div style={styles.errorIcon}>
                !
              </div>

              <div>
                <strong style={styles.errorTitle}>
                  Something needs your attention
                </strong>

                <div style={styles.errorText}>
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              SUBMIT
          ======================================== */}

          <div style={styles.submitSection}>
            <div style={styles.submitHint}>
              <span style={styles.secureIcon}>
                ✦
              </span>

              Your idea is analyzed using the
              information you provide.
            </div>

            <button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              style={{
                ...styles.submitButton,
                ...(loading
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {loading ? (
                <>
                  <span style={styles.spinner} />

                  Saving Your Idea...
                </>
              ) : (
                <>
                  {analysisMode === "tech"
                    ? "Analyze Tech Project"
                    : "Analyze Local Business"}

                  <span style={styles.submitArrow}>
                    →
                  </span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ========================================
            FOOTER NOTE
        ======================================== */}

        <div style={styles.bottomNote}>
          <span style={styles.bottomDot} />

          <span>
            Reality Analyzer helps you validate
            ideas with data before building.
          </span>
        </div>
      </main>

      {/* ========================================
          RESPONSIVE STYLE INJECTION
      ======================================== */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          input::placeholder,
          textarea::placeholder {
            color: #64748b;
          }

          input:focus,
          textarea:focus,
          select:focus {
            outline: none;
            border-color: #8b5cf6 !important;
            box-shadow:
              0 0 0 3px rgba(139, 92, 246, 0.12);
          }

          button {
            font-family: inherit;
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 768px) {
            .analyze-page {
              padding: 28px 14px 50px !important;
            }

            .analyze-container {
              max-width: 100% !important;
            }

            .analyze-title {
              font-size: 36px !important;
            }

            .analyze-subtitle {
              font-size: 15px !important;
            }

            .analyze-main-card {
              padding: 22px !important;
              border-radius: 18px !important;
            }

            .analyze-mode-grid {
              grid-template-columns: 1fr !important;
            }

            .analyze-section {
              padding: 0 !important;
            }

            .analyze-map {
              height: 420px !important;
            }

            .analyze-map-controls {
              width: calc(100% - 20px) !important;
              bottom: 12px !important;
            }

            .analyze-map-button {
              flex: 1 !important;
              min-width: 0 !important;
            }

            .analyze-instruction {
              max-width: calc(100% - 30px) !important;
              min-width: 0 !important;
              width: auto !important;
            }
          }

          @media (max-width: 520px) {
            .analyze-page {
              padding: 22px 10px 40px !important;
            }

            .analyze-title {
              font-size: 30px !important;
              line-height: 1.15 !important;
            }

            .analyze-eyebrow {
              font-size: 11px !important;
            }

            .analyze-main-card {
              padding: 18px !important;
              border-radius: 16px !important;
            }

            .analyze-section-title {
              font-size: 19px !important;
            }

            .analyze-section-description {
              font-size: 13px !important;
            }

            .analyze-mode-card {
              padding: 17px !important;
            }

            .analyze-map {
              height: 390px !important;
            }

            .analyze-map-controls {
              flex-direction: column !important;
            }

            .analyze-map-button {
              width: 100% !important;
              flex: none !important;
            }

            .analyze-instruction-title {
              font-size: 12px !important;
            }

            .analyze-instruction-text {
              font-size: 10px !important;
            }

            .analyze-coordinates {
              font-size: 9px !important;
            }

            .analyze-selected-location {
              padding: 12px !important;
            }

            .analyze-submit {
              font-size: 14px !important;
              padding: 15px !important;
            }

            .analyze-submit-hint {
              font-size: 11px !important;
            }

            .analyze-location-coordinates {
              flex-direction: column !important;
              gap: 4px !important;
            }
          }
        `}
      </style>
    </div>
  );
};

/* ========================================
   STYLES
======================================== */

const styles = {
  /* ========================================
     PAGE
  ======================================== */

  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -20%, #171229 0%, #09090c 38%, #070709 75%)",
    color: "#f8fafc",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "48px 20px 70px",
    position: "relative",
    overflow: "hidden",
  },

  backgroundGlowOne: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background:
      "rgba(124, 58, 237, 0.08)",
    filter: "blur(100px)",
    top: "-300px",
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background:
      "rgba(79, 70, 229, 0.05)",
    filter: "blur(100px)",
    bottom: "-200px",
    right: "-100px",
    pointerEvents: "none",
  },

  container: {
    maxWidth: "960px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  /* ========================================
     HEADER
  ======================================== */

  header: {
    marginBottom: "38px",
  },

  eyebrow: {
    display: "inline-block",
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    marginBottom: "12px",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
  },

  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "48px",
    lineHeight: "1.08",
    fontWeight: "800",
    letterSpacing: "-1.8px",
  },

  subtitle: {
    margin: "14px 0 0",
    maxWidth: "650px",
    color: "#94a3b8",
    fontSize: "16px",
    lineHeight: "1.7",
  },

  /* ========================================
     MAIN CARD
  ======================================== */

  mainCard: {
    background:
      "rgba(17, 17, 20, 0.88)",
    border:
      "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "22px",
    padding: "34px",
    boxShadow:
      "0 25px 70px rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(12px)",
  },

  section: {
    width: "100%",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "15px",
    marginBottom: "24px",
  },

  sectionNumber: {
    flexShrink: 0,
    color: "#8b5cf6",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1px",
    paddingTop: "4px",
  },

  sectionTitle: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "21px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
  },

  sectionDescription: {
    margin: "5px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  divider: {
    height: "1px",
    background:
      "rgba(255, 255, 255, 0.07)",
    margin: "34px 0",
  },

  /* ========================================
     MODE CARDS
  ======================================== */

  modeGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },

  modeCard: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    textAlign: "left",
    padding: "22px",
    background:
      "rgba(10, 10, 13, 0.8)",
    border:
      "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    color: "#f8fafc",
    cursor: "pointer",
    transition:
      "all 0.2s ease",
  },

  activeMode: {
    border:
      "1px solid rgba(139, 92, 246, 0.75)",
    background:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(17, 17, 20, 0.95))",
    boxShadow:
      "0 12px 35px rgba(124, 58, 237, 0.12)",
  },

  modeIconBox: {
    width: "48px",
    height: "48px",
    flexShrink: 0,
    borderRadius: "13px",
    background:
      "rgba(255, 255, 255, 0.06)",
    border:
      "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "23px",
  },

  activeIconBox: {
    background:
      "rgba(139, 92, 246, 0.16)",
    border:
      "1px solid rgba(139, 92, 246, 0.35)",
  },

  modeContent: {
    minWidth: 0,
    flex: 1,
  },

  modeTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  modeTitle: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "17px",
    fontWeight: "700",
  },

  selectedBadge: {
    flexShrink: 0,
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "#c4b5fd",
    background:
      "rgba(139, 92, 246, 0.14)",
    padding: "4px 7px",
    borderRadius: "5px",
  },

  modeText: {
    margin: "8px 0 10px",
    color: "#8b8b94",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  modeExamples: {
    color: "#6d5aa8",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.4px",
  },

  /* ========================================
     FORM
  ======================================== */

  formGroup: {
    marginBottom: "24px",
  },

  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  label: {
    display: "block",
    marginBottom: "9px",
    color: "#e4e4e7",
    fontSize: "13px",
    fontWeight: "650",
  },

  required: {
    color: "#a78bfa",
    marginLeft: "4px",
  },

  optionalHint: {
    color: "#52525b",
    fontSize: "10px",
    marginBottom: "8px",
  },

  input: {
    width: "100%",
    minHeight: "48px",
    padding: "13px 15px",
    border:
      "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    background:
      "rgba(7, 7, 9, 0.9)",
    color: "#f4f4f5",
    fontSize: "14px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition:
      "border-color 0.2s ease, box-shadow 0.2s ease",
  },

  textarea: {
    width: "100%",
    minHeight: "155px",
    padding: "14px 15px",
    border:
      "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    background:
      "rgba(7, 7, 9, 0.9)",
    color: "#f4f4f5",
    fontSize: "14px",
    lineHeight: "1.6",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },

  helpText: {
    margin: "8px 0 0",
    color: "#60606a",
    fontSize: "11px",
    lineHeight: "1.6",
  },

  /* ========================================
     MAP
  ======================================== */

  mapContainer: {
    width: "100%",
    height: "500px",
    borderRadius: "15px",
    overflow: "hidden",
    border:
      "1px solid rgba(255, 255, 255, 0.1)",
    position: "relative",
    background: "#09090b",
  },

  mapWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  centerTarget: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform:
      "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 10,
  },

  targetOuter: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    border:
      "2px solid #a78bfa",
    background:
      "rgba(10, 10, 15, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 0 0 4px rgba(139, 92, 246, 0.12), 0 4px 16px rgba(0, 0, 0, 0.35)",
  },

  targetInner: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "#a78bfa",
    boxShadow:
      "0 0 12px rgba(167, 139, 250, 0.7)",
  },

  mapInstruction: {
    position: "absolute",
    top: "15px",
    left: "50%",
    transform:
      "translateX(-50%)",
    zIndex: 20,
    background:
      "rgba(9, 9, 12, 0.94)",
    border:
      "1px solid rgba(255, 255, 255, 0.1)",
    padding: "11px 16px",
    borderRadius: "10px",
    boxShadow:
      "0 6px 20px rgba(0, 0, 0, 0.3)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    textAlign: "center",
    minWidth: "280px",
    pointerEvents: "none",
  },

  mapInstructionTitle: {
    color: "#f4f4f5",
    fontSize: "12px",
    fontWeight: "700",
  },

  mapInstructionText: {
    color: "#8b8b94",
    fontSize: "10px",
  },

  mapControls: {
    position: "absolute",
    bottom: "18px",
    left: "50%",
    transform:
      "translateX(-50%)",
    zIndex: 20,
    display: "flex",
    gap: "9px",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "auto",
    maxWidth: "calc(100% - 20px)",
  },

  currentLocationButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    minHeight: "42px",
    padding: "10px 15px",
    border:
      "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: "9px",
    background:
      "rgba(9, 9, 12, 0.94)",
    color: "#e4e4e7",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    boxShadow:
      "0 5px 18px rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(8px)",
  },

  useLocationButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    minHeight: "42px",
    padding: "10px 17px",
    border:
      "1px solid rgba(139, 92, 246, 0.7)",
    borderRadius: "9px",
    background:
      "linear-gradient(135deg, #7c3aed, #6d28d9)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
    boxShadow:
      "0 6px 20px rgba(124, 58, 237, 0.3)",
  },

  buttonIcon: {
    fontSize: "13px",
  },

  centerCoordinates: {
    position: "absolute",
    top: "82px",
    left: "50%",
    transform:
      "translateX(-50%)",
    zIndex: 20,
    background:
      "rgba(9, 9, 12, 0.9)",
    border:
      "1px solid rgba(255, 255, 255, 0.08)",
    color: "#a1a1aa",
    padding: "5px 9px",
    borderRadius: "6px",
    fontSize: "9px",
    display: "flex",
    gap: "7px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },

  coordinateDivider: {
    color: "#52525b",
  },

  /* ========================================
     SELECTED LOCATION
  ======================================== */

  selectedLocation: {
    marginTop: "13px",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background:
      "rgba(16, 185, 129, 0.06)",
    border:
      "1px solid rgba(16, 185, 129, 0.18)",
    borderRadius: "10px",
  },

  locationSuccessIcon: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "rgba(16, 185, 129, 0.12)",
    color: "#34d399",
    fontWeight: "800",
    fontSize: "14px",
  },

  locationSuccessContent: {
    minWidth: 0,
  },

  locationSuccessTitle: {
    display: "block",
    color: "#d1fae5",
    fontSize: "12px",
    marginBottom: "5px",
  },

  coordinates: {
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    color: "#6ee7b7",
    fontSize: "11px",
  },

  /* ========================================
     INFO BOX
  ======================================== */

  infoBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "13px",
    padding: "17px",
    marginTop: "6px",
    background:
      "rgba(124, 58, 237, 0.055)",
    border:
      "1px solid rgba(139, 92, 246, 0.13)",
    borderRadius: "12px",
  },

  infoIcon: {
    width: "30px",
    height: "30px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background:
      "rgba(139, 92, 246, 0.12)",
    color: "#a78bfa",
    fontSize: "13px",
  },

  infoTitle: {
    margin: "0 0 5px",
    color: "#c4b5fd",
    fontSize: "12px",
    fontWeight: "700",
  },

  infoText: {
    margin: 0,
    color: "#77717f",
    fontSize: "11px",
    lineHeight: "1.65",
  },

  /* ========================================
     ERROR
  ======================================== */

  error: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px 16px",
    marginTop: "25px",
    borderRadius: "10px",
    background:
      "rgba(239, 68, 68, 0.07)",
    border:
      "1px solid rgba(239, 68, 68, 0.18)",
  },

  errorIcon: {
    width: "25px",
    height: "25px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "rgba(239, 68, 68, 0.12)",
    color: "#f87171",
    fontSize: "12px",
    fontWeight: "800",
  },

  errorTitle: {
    display: "block",
    marginBottom: "3px",
    color: "#fca5a5",
    fontSize: "12px",
  },

  errorText: {
    color: "#a1a1aa",
    fontSize: "11px",
    lineHeight: "1.5",
  },

  /* ========================================
     SUBMIT
  ======================================== */

  submitSection: {
    marginTop: "32px",
    paddingTop: "26px",
    borderTop:
      "1px solid rgba(255, 255, 255, 0.07)",
  },

  submitHint: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    marginBottom: "13px",
    color: "#52525b",
    fontSize: "11px",
    textAlign: "center",
  },

  secureIcon: {
    color: "#8b5cf6",
    fontSize: "10px",
  },

  submitButton: {
    width: "100%",
    minHeight: "54px",
    padding: "15px 20px",
    border:
      "1px solid rgba(139, 92, 246, 0.65)",
    borderRadius: "11px",
    cursor: "pointer",
    background:
      "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "750",
    letterSpacing: "0.1px",
    boxShadow:
      "0 10px 30px rgba(109, 40, 217, 0.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    transition:
      "transform 0.2s ease, box-shadow 0.2s ease",
  },

  submitArrow: {
    fontSize: "19px",
    lineHeight: 1,
  },

  disabledButton: {
    opacity: 0.65,
    cursor: "not-allowed",
    boxShadow: "none",
  },

  spinner: {
    width: "15px",
    height: "15px",
    border:
      "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#ffffff",
    borderRadius: "50%",
    display: "inline-block",
    animation:
      "spin 0.7s linear infinite",
  },

  /* ========================================
     BOTTOM NOTE
  ======================================== */

  bottomNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    marginTop: "22px",
    color: "#45454d",
    fontSize: "10px",
    textAlign: "center",
  },

  bottomDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#6d28d9",
  },
};

export default AnalyzeIdea;