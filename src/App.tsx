import { NavLink, Route, Routes } from "react-router-dom";
import { FileRegistry } from "./pages/FileRegistry";
import { GitHubProjects } from "./pages/GitHubProjects";
import { GitHubRepoFiles } from "./pages/GitHubRepoFiles";
import { GitHubRepoOverview } from "./pages/GitHubRepoOverview";
import { ProgressOverview } from "./pages/ProgressOverview";

export function App() {
  return (
    <div className="layout">
      <header className="header">
        <NavLink to="/" className="brand" end>
          Application progress
        </NavLink>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")} end>
            All projects
          </NavLink>
          <NavLink
            to="/local"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Local overview
          </NavLink>
          <NavLink
            to="/local/files"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Local files
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<GitHubProjects />} />
          <Route path="/local" element={<ProgressOverview />} />
          <Route path="/local/files" element={<FileRegistry />} />
          <Route path="/github/:owner/:repo" element={<GitHubRepoOverview />} />
          <Route
            path="/github/:owner/:repo/files"
            element={<GitHubRepoFiles />}
          />
        </Routes>
      </main>
    </div>
  );
}
