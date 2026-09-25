export function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-bg-card border border-bg-border rounded-lg p-4 ${className}`}>
      {title && <h3 className="text-sm font-medium text-slate-400 mb-3">{title}</h3>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, accent = "text-slate-100" }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

const SEVERITY_STYLES = {
  Low: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  High: "bg-risk-high/15 text-risk-high border-risk-high/30",
  Critical: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
};

export function SeverityBadge({ severity }) {
  const cls = SEVERITY_STYLES[severity] || "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {severity}
    </span>
  );
}

export function ProtocolBadge({ protocol }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-mono bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
      {protocol}
    </span>
  );
}
