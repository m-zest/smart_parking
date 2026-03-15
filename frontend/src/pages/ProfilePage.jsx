import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const [p, pay] = await Promise.all([
        ApiClient.getUser(user.user_id),
        ApiClient.getPaymentHistory(user.user_id),
      ]);
      setProfile(p);
      setPayments(pay);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading profile...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const stats = profile.stats || {};

  return (
    <div className="page">
      <h1>My Profile</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2>{profile.name}</h2>
            <p className="text-muted" style={{ marginBottom: "4px" }}>{profile.email}</p>
            <span className={`badge badge--${profile.role === "admin" ? "active" : "paid"}`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__label">Total Sessions</div>
          <div className="stat-card__value">{stats.total_sessions || 0}</div>
        </div>
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Active Sessions</div>
          <div className="stat-card__value">{stats.active_sessions || 0}</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__label">Total Paid</div>
          <div className="stat-card__value">{(stats.total_paid || 0).toLocaleString()} HUF</div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__label">Total Unpaid</div>
          <div className="stat-card__value">{(stats.total_unpaid || 0).toLocaleString()} HUF</div>
        </div>
      </div>

      {/* Current Sessions */}
      {profile.sessions && profile.sessions.length > 0 && (
        <div className="card">
          <h2>My Sessions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Zone</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {profile.sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="mono">{s.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{s.plate_number}</td>
                    <td>{s.zone_id}</td>
                    <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                    <td>{s.exit_timestamp ? new Date(s.exit_timestamp).toLocaleString() : "-"}</td>
                    <td>{s.duration_minutes != null ? `${s.duration_minutes} min` : "-"}</td>
                    <td className="bold">{s.final_fee != null ? `${s.final_fee.toLocaleString()} HUF` : "-"}</td>
                    <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="card">
        <h2>Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-muted">No payments yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Session</th>
                  <th>Plate</th>
                  <th>Amount</th>
                  <th>Card</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td className="mono">{p.payment_id.slice(0, 8)}...</td>
                    <td className="mono">{p.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{p.plate_number}</td>
                    <td className="bold">{p.amount.toLocaleString()} HUF</td>
                    <td>{p.card_last_four ? `****${p.card_last_four}` : "-"}</td>
                    <td>{new Date(p.payment_timestamp).toLocaleString()}</td>
                    <td><span className="badge badge--paid">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
