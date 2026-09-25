import { useEffect, useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { getOverview, getModelInfo } from "../api";
import { Card, StatCard, SeverityBadge, ProtocolBadge } from "../components";

const PROTOCOL_COLORS = { TCP: "#3b82f6", UDP: "#22d3ee", ICMP: "#a855f7", OTHER: "#64748b" };
const TOOLTIP_STYLE = { background: "#111823", border: "1px solid #1f2937", fontSize: 12 };
const AXIS_PROPS = { stroke: "#64748b", fontSize: 11, tickLine: false, axisLine: { stroke: "#1f2937" } };

function MLInfoModal({ overview, onClose }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getModelInfo().then(setInfo).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-bg-border rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-accent-cyan font-semibold">ⓘ ML Info</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        {error && <p className="text-risk-high text-sm">Failed to load model info: {error}</p>}
        {!error && !info && <p className="text-slate-500 text-sm">Loading model info...</p>}

        {info && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 uppercase">Model</p>
                <p className="text-slate-200">{info.model_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Type</p>
                <p className="text-slate-200">Unsupervised anomaly detection</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Records (current)</p>
                <p className="text-slate-200">{overview ? overview.total_events : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Anomalies (current)</p>
                <p className="text-risk-high">{overview ? overview.anomalies : "—"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase mb-1.5">Features Used</p>
              <div className="flex flex-wrap gap-1.5">
                {info.features_used.map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/30 text-xs font-mono">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase mb-1.5">Excluded Fields</p>
              <div className="flex flex-wrap gap-1.5">
                {info.excluded_columns.map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/30 text-xs font-mono">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase mb-1">How it works</p>
              <p className="text-slate-400">
                Isolation Forest builds many random decision trees that split the
                traffic features at random values. Records that sit far from
                normal patterns get isolated in very few splits, so they end up
                with short average path lengths across the trees — that
                "easy to isolate" signal is converted into an anomaly score.
                Records with the highest scores are flagged as unusual.
              </p>
            </div>

            <div className="border-t border-bg-border pt-3">
              <p className="text-risk-medium font-medium">
                ⚠ Anomalous ≠ confirmed attack. A flag means the model found
                traffic that statistically differs from the rest of the
                dataset, not a verified security incident. Every flagged
                record needs human review.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showMLInfo, setShowMLInfo] = useState(false);

  useEffect(() => {
    getOverview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-risk-high">Failed to load overview: {error}</p>;
  if (!data) return <p className="text-slate-500">Loading overview...</p>;

  const timeline = data.timeline; // pre-aggregated by backend into time buckets
  const rotateLabels = timeline.length > 8;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400">Overview</h2>
        <button
          onClick={() => setShowMLInfo(true)}
          className="flex items-center gap-1.5 bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 rounded px-2.5 py-1 text-xs hover:bg-accent-cyan/20"
        >
          <span className="font-semibold">ⓘ</span> ML Info
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Events" value={data.total_events} />
        <StatCard label="Normal Traffic" value={data.normal_traffic} accent="text-risk-low" />
        <StatCard label="Anomalies" value={data.anomalies} accent="text-risk-high" />
        <StatCard label="High-Anomaly Events" value={data.high_risk_events} accent="text-risk-critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`Traffic Timeline (bucketed by ${data.timeline_bucket_label})`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: rotateLabels ? 28 : 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="bucket"
                {...AXIS_PROPS}
                interval="preserveStartEnd"
                angle={rotateLabels ? -35 : 0}
                textAnchor={rotateLabels ? "end" : "middle"}
                height={rotateLabels ? 46 : 24}
              />
              <YAxis {...AXIS_PROPS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Total Events" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="anomalies" name="Anomalies" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Anomaly Activity (rate %)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: rotateLabels ? 28 : 4 }}>
              <defs>
                <linearGradient id="anomalyRateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="bucket"
                {...AXIS_PROPS}
                interval="preserveStartEnd"
                angle={rotateLabels ? -35 : 0}
                textAnchor={rotateLabels ? "end" : "middle"}
                height={rotateLabels ? 46 : 24}
              />
              <YAxis {...AXIS_PROPS} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Anomaly Rate"]} />
              <Area type="monotone" dataKey="anomaly_rate" name="Anomaly Rate" stroke="#ef4444" strokeWidth={2} fill="url(#anomalyRateFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Protocol Distribution">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data.protocol_distribution}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="protocol" {...AXIS_PROPS} width={50} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, props) => [`${value} (${props.payload.percentage}%)`, "Count"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                {data.protocol_distribution.map((entry) => (
                  <Cell key={entry.protocol} fill={PROTOCOL_COLORS[entry.protocol] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Source IPs">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data.top_source_ips}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="ip" {...AXIS_PROPS} width={90} fontSize={10} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Destination IPs">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data.top_destination_ips}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="ip" {...AXIS_PROPS} width={90} fontSize={10} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Recent Anomalies">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-bg-border">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Destination</th>
                <th className="py-2 pr-4">Protocol</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Severity</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_anomalies.map((row) => (
                <tr key={row.id} className="border-b border-bg-border/50">
                  <td className="py-2 pr-4 text-slate-400">{row.timestamp}</td>
                  <td className="py-2 pr-4 font-mono">{row.source_ip}</td>
                  <td className="py-2 pr-4 font-mono">{row.destination_ip}</td>
                  <td className="py-2 pr-4"><ProtocolBadge protocol={row.protocol} /></td>
                  <td className="py-2 pr-4">{row.model_anomaly_score}</td>
                  <td className="py-2 pr-4"><SeverityBadge severity={row.model_severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showMLInfo && <MLInfoModal overview={data} onClose={() => setShowMLInfo(false)} />}
    </div>
  );
}
