import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

const PENALTY_THRESHOLD = 200000;

const LEGAL_WARNINGS = [
  "Unpaid parking/session charges may result in a surcharge under Hungarian road transport law.",
  "If paid within 15 days, the surcharge is based on the fee for the chargeable parking period on that day plus two extra hours.",
  "If paid after 15 days, the surcharge can increase to 40 times the one-hour parking fee.",
  "The payment demand must generally be sent within 60 days.",
  "The fee/surcharge claim generally expires after 1 year.",
  "Default interest is not claimable on the fee/surcharge under this provision (NJT).",
];

export default function PaymentPage() {
  const { user } = useAuth();
  const [plateNumber, setPlateNumber] = useState("");
  const [unpaidData, setUnpaidData] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Card form
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Receipt
  const [receipt, setReceipt] = useState(null);

  // Penalty
  const [penaltyInfo, setPenaltyInfo] = useState(null);

  async function handleLookup(e) {
    e.preventDefault();
    if (!plateNumber.trim()) return;
    setLoading(true);
    setError(null);
    setUnpaidData(null);
    setReceipt(null);
    setPenaltyInfo(null);
    setSelectedSessions([]);

    try {
      const data = await ApiClient.getUnpaidSessions(plateNumber.trim().toUpperCase());
      setUnpaidData(data);

      // Check penalty
      if (data.total_unpaid >= PENALTY_THRESHOLD) {
        const penalty = await ApiClient.checkPenalty(plateNumber.trim().toUpperCase());
        setPenaltyInfo(penalty);
        // Reload after penalty applied
        if (penalty.penalty_applied) {
          const refreshed = await ApiClient.getUnpaidSessions(plateNumber.trim().toUpperCase());
          setUnpaidData(refreshed);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSession(sessionId) {
    setSelectedSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  }

  function selectAll() {
    if (!unpaidData) return;
    setSelectedSessions(unpaidData.sessions.map((s) => s.session_id));
  }

  function getSelectedTotal() {
    if (!unpaidData) return 0;
    return unpaidData.sessions
      .filter((s) => selectedSessions.includes(s.session_id))
      .reduce((sum, s) => sum + (s.final_fee || 0), 0);
  }

  async function handlePayment(e) {
    e.preventDefault();
    if (selectedSessions.length === 0) return;
    setProcessing(true);
    setError(null);

    try {
      const lastFour = cardNumber.replace(/\s/g, "").slice(-4);
      const result = await ApiClient.paySessions(
        selectedSessions,
        user?.user_id || "",
        cardName,
        lastFour
      );
      setReceipt(result);
      setShowCardForm(false);
      setSelectedSessions([]);

      // Refresh unpaid
      const refreshed = await ApiClient.getUnpaidSessions(plateNumber.trim().toUpperCase());
      setUnpaidData(refreshed);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }

  const selectedTotal = getSelectedTotal();

  return (
    <div className="page">
      <h1>Payment</h1>

      {/* Lookup */}
      <div className="card">
        <h2>Find Unpaid Sessions</h2>
        <form onSubmit={handleLookup} className="form-row">
          <input
            type="text"
            className="input"
            placeholder="Enter plate number (e.g. ABC-1234)"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            required
          />
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* Penalty Warning */}
      {penaltyInfo && penaltyInfo.penalty_applied && (
        <div className="alert alert--error penalty-alert">
          <strong>PENALTY NOTICE</strong>
          <p>{penaltyInfo.message}</p>
        </div>
      )}

      {/* Overdue Warning */}
      {unpaidData && unpaidData.total_unpaid > 0 && (
        <div className="alert alert--warning">
          <strong>Your payment is overdue.</strong> Please pay immediately to avoid higher surcharges.
          Long non-payment may lead to legal recovery steps. Use the form below to clear your dues.
        </div>
      )}

      {/* Legal Notice */}
      {unpaidData && unpaidData.total_unpaid >= 50000 && (
        <div className="card legal-notice">
          <h2>Legal Notice - Hungarian Parking Regulations</h2>
          <ul className="legal-list">
            {LEGAL_WARNINGS.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Receipt */}
      {receipt && (
        <div className="card receipt-card">
          <h2>Payment Receipt</h2>
          <div className="receipt-success">Payment Successful</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Total Paid</span>
              <span className="detail-value bold" style={{ fontSize: "1.4rem", color: "var(--color-success)" }}>
                {receipt.total_paid.toLocaleString()} HUF
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Sessions Paid</span>
              <span className="detail-value">{receipt.receipts.length}</span>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Amount</th>
                  <th>Date/Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receipt.receipts.map((r) => (
                  <tr key={r.payment_id}>
                    <td className="mono">{r.payment_id.slice(0, 8)}...</td>
                    <td className="mono">{r.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{r.plate_number}</td>
                    <td className="bold">{r.amount.toLocaleString()} HUF</td>
                    <td>{new Date(r.payment_timestamp).toLocaleString()}</td>
                    <td><span className="badge badge--paid">Paid</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unpaid Sessions */}
      {unpaidData && unpaidData.sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Unpaid Sessions ({unpaidData.sessions.length}) - Total: {unpaidData.total_unpaid.toLocaleString()} HUF</h2>
            <button className="btn btn--sm btn--outline" onClick={selectAll}>Select All</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Session ID</th>
                  <th>Zone</th>
                  <th>Entry</th>
                  <th>Duration</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unpaidData.sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(s.session_id)}
                        onChange={() => toggleSession(s.session_id)}
                      />
                    </td>
                    <td className="mono">{s.session_id.slice(0, 8)}...</td>
                    <td>{s.zone_id}</td>
                    <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                    <td>{s.duration_minutes != null ? `${s.duration_minutes} min` : "-"}</td>
                    <td className="bold">{s.final_fee != null ? `${s.final_fee.toLocaleString()} HUF` : "-"}</td>
                    <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSessions.length > 0 && (
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <p className="bold" style={{ marginBottom: "8px" }}>
                Selected: {selectedSessions.length} session(s) - {selectedTotal.toLocaleString()} HUF
              </p>
              <button className="btn btn--primary btn--lg" onClick={() => setShowCardForm(true)}>
                Proceed to Payment
              </button>
            </div>
          )}
        </div>
      )}

      {unpaidData && unpaidData.sessions.length === 0 && (
        <div className="alert alert--success">
          No unpaid sessions found for {plateNumber.toUpperCase()}. All clear!
        </div>
      )}

      {/* Card Payment Form */}
      {showCardForm && (
        <div className="card payment-form-card">
          <h2>Payment Details (Demo)</h2>
          <p className="text-muted">This is a demo payment form. No real charges will be made.</p>
          <form onSubmit={handlePayment} className="form-grid form-grid--2col">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Cardholder Name</label>
              <input
                type="text"
                className="input"
                placeholder="Name on card"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Card Number</label>
              <input
                type="text"
                className="input"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                maxLength={19}
              />
            </div>
            <div className="form-group">
              <label>Expiry Date</label>
              <input
                type="text"
                className="input"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
                maxLength={5}
              />
            </div>
            <div className="form-group">
              <label>CVV</label>
              <input
                type="text"
                className="input"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                required
                maxLength={4}
              />
            </div>
            <div className="form-group form-group--actions">
              <button type="submit" className="btn btn--primary btn--lg" disabled={processing}>
                {processing ? "Processing..." : `Pay ${selectedTotal.toLocaleString()} HUF`}
              </button>
              <button type="button" className="btn btn--outline btn--lg" onClick={() => setShowCardForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
