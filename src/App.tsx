import { NavLink, Route, Routes } from "react-router-dom";
import { ProgressOverview } from "./pages/ProgressOverview";
import { FileRegistry } from "./pages/FileRegistry";

export function App() {
  return (
    <div className="layout">
      <header className="header">
        <NavLink to="/" className="brand" end>
          Application progress
        </NavLink>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")} end>
            Overview
          </NavLink>
          <NavLink
            to="/files"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            File registry
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<ProgressOverview />} />
          <Route path="/files" element={<FileRegistry />} />
        </Routes>
      </main>
    </div>
  );
}
