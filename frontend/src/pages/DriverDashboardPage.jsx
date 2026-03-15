import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ApiClient from "../services/ApiClient";
import { useAuth } from "../context/AuthContext";

const BUDAPEST_CENTER = [47.4979, 19.0402];

const ZONE_LOCATIONS = {
  Z_001: { lat: 47.4962, lng: 19.0395, name: "District I - Downtown" },
  Z_002: { lat: 47.5074, lng: 19.0310, name: "District II - Center" },
  Z_003: { lat: 47.5355, lng: 19.0414, name: "District III" },
  Z_004: { lat: 47.5597, lng: 19.0828, name: "District IV" },
  Z_005: { lat: 47.5001, lng: 19.0516, name: "District V" },
  Z_006: { lat: 47.5058, lng: 19.0651, name: "District VI" },
  Z_007: { lat: 47.4986, lng: 19.0735, name: "District VII" },
};

const CONGESTION_COLORS = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const PENALTY_THRESHOLD = 200000;

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Payment state
  const [paymentMsg, setPaymentMsg] = useState(null);
  const [payingSession, setPayingSession] = useState(null);

  // Penalty state
  const [penaltyInfo, setPenaltyInfo] = useState(null);

  // Map congestion
  const [congestion, setCongestion] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    loadMapData();
  }, []);

  async function loadMapData() {
    try {
      const [c, z] = await Promise.all([
        ApiClient.getCongestion(),
        ApiClient.listZones(),
      ]);
      setCongestion(c);
      setZones(z);
    } catch (e) {
      // Map data is non-critical
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    if (!plateNumber.trim()) return;

    setLoading(true);
    setError(null);
    setVehicle(null);
    setSessions([]);
    setSearched(true);
    setPaymentMsg(null);
    setPenaltyInfo(null);

    try {
      const v = await ApiClient.getVehicle(plateNumber.trim().toUpperCase());
      setVehicle(v);

      const allSessions = await ApiClient.listSessions();
      const mySessions = allSessions.filter(
        (s) => s.plate_number === plateNumber.trim().toUpperCase()
      );
      setSessions(mySessions);

      // Check penalty threshold
      await checkPenaltyStatus(plateNumber.trim().toUpperCase());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkPenaltyStatus(plate) {
    try {
      const result = await ApiClient.checkPenalty(plate);
      setPenaltyInfo(result);
    } catch (e) {
      // Non-critical
    }
  }

  async function handlePaySession(sessionId) {
    setPayingSession(sessionId);
    setPaymentMsg(null);
    try {
      await ApiClient.paySessions([sessionId]);
      setPaymentMsg({ type: "success", text: `Payment successful for session ${sessionId.slice(0, 8)}...` });
      // Refresh data
      const allSessions = await ApiClient.listSessions();
      const mySessions = allSessions.filter(
        (s) => s.plate_number === plateNumber.trim().toUpperCase()
      );
      setSessions(mySessions);
      await checkPenaltyStatus(plateNumber.trim().toUpperCase());
      loadMapData();
    } catch (e) {
      setPaymentMsg({ type: "error", text: e.message });
    } finally {
      setPayingSession(null);
    }
  }

  async function handlePayAll() {
    setPaymentMsg(null);
    try {
      const result = await ApiClient.payAllByPlate(plateNumber.trim().toUpperCase());
      setPaymentMsg({
        type: "success",
        text: `All unpaid sessions cleared! Total paid: ${result.total_paid.toLocaleString()} HUF`,
      });
      const allSessions = await ApiClient.listSessions();
      const mySessions = allSessions.filter(
        (s) => s.plate_number === plateNumber.trim().toUpperCase()
      );
      setSessions(mySessions);
      setPenaltyInfo(null);
      loadMapData();
    } catch (e) {
      setPaymentMsg({ type: "error", text: e.message });
    }
  }

  const activeSessions = sessions.filter((s) => s.status === "active");
  const unpaidSessions = sessions.filter((s) => s.status === "unpaid" || s.status === "overdue");
  const totalFees = sessions.reduce((sum, s) => sum + (s.final_fee || 0), 0);
  const totalUnpaid = unpaidSessions.reduce((sum, s) => sum + (s.final_fee || 0), 0);

  // Build congestion map
  const congestionMap = {};
  congestion.forEach((c) => {
    congestionMap[c.zone_id] = c;
  });

  return (
    <div className="page">
      <h1>Driver Dashboard</h1>

      {/* Budapest Map */}
      <div className="card">
        <h2>Budapest Parking Map - Live Congestion</h2>
        <p className="text-muted">
          Click on markers to see zone details. Colors indicate congestion levels.
        </p>
        <div className="map-container">
          <MapContainer
            center={BUDAPEST_CENTER}
            zoom={12}
            style={{ height: "400px", width: "100%", borderRadius: "8px" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Object.entries(ZONE_LOCATIONS).map(([zoneId, loc]) => {
              const cData = congestionMap[zoneId];
              const activeCount = cData?.active_vehicles || 0;
              const level = cData?.congestion_level || "low";
              const zone = zones.find((z) => z.zone_id === zoneId);
              const color = CONGESTION_COLORS[level];

              return (
                <CircleMarker
                  key={zoneId}
                  center={[loc.lat, loc.lng]}
                  radius={14 + activeCount * 2}
                  fillColor={color}
                  color={color}
                  weight={3}
                  opacity={0.9}
                  fillOpacity={0.5}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>{loc.name}</strong>
                      <br />
                      <span>Zone: {zoneId}</span>
                      <br />
                      <span>Active Vehicles: {activeCount}</span>
                      <br />
                      <span>
                        Congestion:{" "}
                        <span style={{ color, fontWeight: 700 }}>
                          {level === "low"
                            ? "Low - Spaces Available"
                            : level === "medium"
                            ? "Medium Usage"
                            : "Highly Crowded"}
                        </span>
                      </span>
                      <br />
                      {zone && (
                        <span>Rate: {zone.base_hourly_rate.toLocaleString()} HUF/hr</span>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <div className="map-legend">
          <span className="map-legend__item">
            <span className="map-legend__dot" style={{ background: "#22c55e" }} />
            Low Traffic
          </span>
          <span className="map-legend__item">
            <span className="map-legend__dot" style={{ background: "#f59e0b" }} />
            Medium Usage
          </span>
          <span className="map-legend__item">
            <span className="map-legend__dot" style={{ background: "#ef4444" }} />
            Highly Crowded
          </span>
        </div>
      </div>

      {/* Lookup Form */}
      <div className="card">
        <h2>Look Up Your Vehicle</h2>
        <form onSubmit={handleLookup} className="form-row">
          <input
            type="text"
            placeholder="Enter plate number (e.g. ABC-1234)"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            className="input"
          />
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {searched && !loading && !error && !vehicle && (
        <div className="alert alert--warning">
          No vehicle found with plate "{plateNumber.toUpperCase()}". Make sure
          your vehicle is registered.
        </div>
      )}

      {/* Penalty Warning */}
      {penaltyInfo && penaltyInfo.penalty_applied && (
        <div className="alert alert--error penalty-alert">
          <strong>PENALTY NOTICE</strong>
          <p>{penaltyInfo.message}</p>
          <p className="penalty-legal">
            According to Budapest parking enforcement regulations, unpaid parking fees
            exceeding {PENALTY_THRESHOLD.toLocaleString()} HUF are subject to automatic doubling
            of the outstanding amount. Continued non-payment may result in additional penalties
            or legal enforcement actions including vehicle immobilization.
          </p>
          <button className="btn btn--primary" onClick={handlePayAll} style={{ marginTop: "12px" }}>
            Pay Now - {penaltyInfo.total_unpaid.toLocaleString()} HUF
          </button>
        </div>
      )}

      {paymentMsg && (
        <div className={`alert alert--${paymentMsg.type}`}>{paymentMsg.text}</div>
      )}

      {/* Vehicle Info */}
      {vehicle && (
        <>
          <div className="card">
            <h2>Vehicle Information</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Plate Number</span>
                <span className="detail-value mono bold">
                  {vehicle.plate_number}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Owner</span>
                <span className="detail-value">{vehicle.owner_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Vehicle Type</span>
                <span className="detail-value">{vehicle.vehicle_type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Payment Status</span>
                <span className="detail-value">
                  {totalUnpaid > 0 ? (
                    <span className="badge badge--unpaid">
                      Unpaid - {totalUnpaid.toLocaleString()} HUF
                    </span>
                  ) : (
                    <span className="badge badge--paid">All Paid</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="card-grid">
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Total Sessions</div>
              <div className="stat-card__value">{sessions.length}</div>
            </div>
            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Active Now</div>
              <div className="stat-card__value">{activeSessions.length}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Unpaid</div>
              <div className="stat-card__value">{unpaidSessions.length}</div>
            </div>
            <div className="stat-card stat-card--revenue">
              <div className="stat-card__label">Total Fees</div>
              <div className="stat-card__value">
                {totalFees.toLocaleString()} HUF
              </div>
            </div>
          </div>

          {/* Unpaid Sessions with Pay button */}
          {unpaidSessions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>Unpaid Sessions ({unpaidSessions.length})</h2>
                <button className="btn btn--primary" onClick={handlePayAll}>
                  Pay All ({totalUnpaid.toLocaleString()} HUF)
                </button>
              </div>
              {totalUnpaid >= PENALTY_THRESHOLD && !penaltyInfo?.penalty_applied && (
                <div className="alert alert--warning" style={{ marginTop: "12px" }}>
                  Your unpaid amount ({totalUnpaid.toLocaleString()} HUF) has reached the
                  penalty threshold of {PENALTY_THRESHOLD.toLocaleString()} HUF.
                  A penalty doubling may be applied. Please pay immediately.
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry</th>
                      <th>Duration</th>
                      <th>Fee</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidSessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{s.zone_id}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                        <td>{s.duration_minutes != null ? `${s.duration_minutes} min` : "-"}</td>
                        <td className="bold">
                          {s.final_fee != null ? `${s.final_fee.toLocaleString()} HUF` : "-"}
                        </td>
                        <td>
                          <span className={`badge badge--${s.status}`}>{s.status}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => handlePaySession(s.session_id)}
                            disabled={payingSession === s.session_id}
                          >
                            {payingSession === s.session_id ? "Processing..." : "Pay"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="card">
              <h2>Currently Parked</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{s.zone_id}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                        <td><span className="badge badge--active">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full Parking History */}
          {sessions.length > 0 && (
            <div className="card">
              <h2>Parking History</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Duration</th>
                      <th>Base Fee</th>
                      <th>Penalties</th>
                      <th>Final Fee</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{s.zone_id}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                        <td>
                          {s.exit_timestamp
                            ? new Date(s.exit_timestamp).toLocaleString()
                            : "-"}
                        </td>
                        <td>
                          {s.duration_minutes != null ? `${s.duration_minutes} min` : "-"}
                        </td>
                        <td>
                          {s.base_fee != null ? `${s.base_fee.toLocaleString()}` : "-"}
                        </td>
                        <td>
                          {s.overstay_penalty != null
                            ? `+${(s.overstay_penalty + (s.repeat_penalty || 0)).toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="bold">
                          {s.final_fee != null ? `${s.final_fee.toLocaleString()} HUF` : "-"}
                        </td>
                        <td>
                          <span className={`badge badge--${s.status}`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
