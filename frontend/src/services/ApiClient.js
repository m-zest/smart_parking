const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ApiClient = {
  // ── Health ──
  async healthCheck() {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
  },

  // ── Zones ──
  async listZones() {
    const res = await fetch(`${BASE_URL}/zones/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createZone(zone) {
    const res = await fetch(`${BASE_URL}/zones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create zone");
    }
    return res.json();
  },

  async updateZone(zoneId, zone) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update zone");
    }
    return res.json();
  },

  async deleteZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete zone");
    }
    return res.json();
  },

  // ── Sessions ──
  async listSessions(dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_URL}/sessions/${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createSession(plateNumber, zoneId, entryTimestamp = null) {
    const body = { plate_number: plateNumber, zone_id: zoneId };
    if (entryTimestamp) body.entry_timestamp = entryTimestamp;
    const res = await fetch(`${BASE_URL}/sessions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create session");
    }
    return res.json();
  },

  async closeSession(sessionId, exitTimestamp = null) {
    const body = {};
    if (exitTimestamp) body.exit_timestamp = exitTimestamp;
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/close`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to close session");
    }
    return res.json();
  },

  // ── Vehicles ──
  async listVehicles() {
    const res = await fetch(`${BASE_URL}/vehicles/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVehicle(plateNumber) {
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Vehicle not found");
    }
    return res.json();
  },

  async createVehicle(vehicle) {
    const res = await fetch(`${BASE_URL}/vehicles/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicle),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create vehicle");
    }
    return res.json();
  },

  async deleteVehicle(plateNumber) {
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete vehicle");
    }
    return res.json();
  },

  // ── Reports ──
  async revenueByZone() {
    const res = await fetch(`${BASE_URL}/reports/revenue-by-zone`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async revenueSummary() {
    const res = await fetch(`${BASE_URL}/reports/revenue-summary`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ── Upload ──
  async uploadPlateImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/upload/plate-image`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to process image");
    }
    return res.json();
  },
};

export default ApiClient;
