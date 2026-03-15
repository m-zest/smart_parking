import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import SessionsPage from "./pages/SessionsPage";
import ZoneConfigPage from "./pages/ZoneConfigPage";
import UploadImagePage from "./pages/UploadImagePage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import PaymentPage from "./pages/PaymentPage";
import UsersPage from "./pages/UsersPage";

function TopBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="topbar">
      <div className="topbar__left">
        <span className="topbar__greeting">Welcome, {user.name}</span>
        <span className={`badge badge--${user.role === "admin" ? "active" : "paid"}`}>
          {user.role}
        </span>
      </div>
      <div className="topbar__right">
        <NavLink to="/profile" className="profile-icon" title="My Profile">
          {user.name.charAt(0).toUpperCase()}
        </NavLink>
        <button className="btn btn--sm btn--outline topbar__logout" onClick={logout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();

  const adminLinks = [
    { to: "/", label: "Admin Dashboard", icon: "grid" },
    { to: "/users", label: "Users", icon: "users" },
    { to: "/driver", label: "Driver View", icon: "user" },
    { to: "/sessions", label: "Sessions", icon: "clock" },
    { to: "/zones", label: "Zone Config", icon: "map" },
    { to: "/upload", label: "Upload Image", icon: "camera" },
    { to: "/reports", label: "Reports", icon: "bar-chart" },
    { to: "/payment", label: "Payment", icon: "credit-card" },
    { to: "/profile", label: "Profile", icon: "profile" },
  ];

  const driverLinks = [
    { to: "/driver", label: "My Dashboard", icon: "user" },
    { to: "/sessions", label: "Sessions", icon: "clock" },
    { to: "/upload", label: "Upload Image", icon: "camera" },
    { to: "/payment", label: "Payment", icon: "credit-card" },
    { to: "/profile", label: "Profile", icon: "profile" },
  ];

  const links = user?.role === "admin" ? adminLinks : driverLinks;

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18" />
            <path d="M3 9h6" />
            <path d="M3 15h6" />
          </svg>
          {!collapsed && <span>Smart Parking</span>}
        </div>
        <button className="sidebar__toggle" onClick={onToggle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      <nav className="sidebar__nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
            }
          >
            <SidebarIcon name={link.icon} />
            {!collapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function SidebarIcon({ name }) {
  const icons = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    map: (
      <>
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </>
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    "bar-chart": (
      <>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </>
    ),
    "credit-card": (
      <>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </>
    ),
    profile: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };

  return (
    <svg
      className="sidebar__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

function AuthenticatedApp() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="app">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="main-content">
        <TopBar />
        <Routes>
          {user?.role === "admin" ? (
            <Route path="/" element={<AdminDashboardPage />} />
          ) : (
            <Route path="/" element={<Navigate to="/driver" replace />} />
          )}
          <Route path="/driver" element={<DriverDashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/zones" element={<ZoneConfigPage />} />
          <Route path="/upload" element={<UploadImagePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/landing" element={user ? <Navigate to="/" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Protected routes */}
      <Route path="/*" element={user ? <AuthenticatedApp /> : <Navigate to="/landing" replace />} />
    </Routes>
  );
}
