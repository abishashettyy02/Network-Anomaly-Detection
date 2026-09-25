import { useState } from "react";
import Overview from "./pages/Overview";
import NetworkAnalysis from "./pages/NetworkAnalysis";
import Anomalies from "./pages/Anomalies";
import Investigation from "./pages/Investigation";
import Navi from "./Navi";

const TABS = [
  { key: "overview", label: "Overview", component: Overview },
  { key: "network", label: "Network Analysis", component: NetworkAnalysis },
  { key: "anomalies", label: "Anomalies", component: Anomalies },
  { key: "investigation", label: "Investigation", component: Investigation },
];

export default function App() {
  const [active, setActive] = useState("overview");
  const ActiveComponent = TABS.find((t) => t.key === active).component;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border bg-bg-panel px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-cyan"></span>
          <h1 className="text-lg font-semibold text-slate-100">Network Anomaly Detection</h1>
          <span className="text-xs text-slate-500 border border-bg-border rounded px-2 py-0.5 ml-2">Demo Data</span>
        </div>
      </header>

      <nav className="border-b border-bg-border bg-bg-panel px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
              active === t.key
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        <ActiveComponent />
      </main>

      <Navi />
    </div>
  );
}
