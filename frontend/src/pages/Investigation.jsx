import { useState } from "react";
import { getAnomalyDetail, getAnomalies } from "../api";
import { Card, SeverityBadge, ProtocolBadge } from "../components";

export default function Investigation() {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState(null);

  const search = async () => {
    setError(null);
    setDetail(null);
    setCandidates([]);
    const trimmed = query.trim();
    if (!trimmed) return;

    if (/^\d+$/.test(trimmed)) {
      try {
        const d = await getAnomalyDetail(Number(trimmed));
        setDetail(d);
        return;
      } catch {
        // fall through to IP search
      }
    }

    const res = await getAnomalies({ search: trimmed, limit: 20 });
    if (res.records.length === 0) {
      setError("No anomaly found for that ID / IP.");
    } else {
      setCandidates(res.records);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Investigate by Anomaly ID or IP address">
        <div className="flex gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. 42 or 192.168.1.24"
            className="bg-bg-panel border border-bg-border rounded px-3 py-2 text-sm flex-1"
          />
          <button onClick={search}
                  className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40 rounded px-4 py-2 text-sm hover:bg-accent-blue/30">
            Investigate
          </button>
        </div>
        {error && <p className="text-risk-high text-sm mt-3">{error}</p>}
      </Card>

      {candidates.length > 0 && (
        <Card title={`${candidates.length} matching anomalies — select one`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-bg-border">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Destination</th>
                  <th className="py-2 pr-4">Protocol</th>
                  <th className="py-2 pr-4">Severity</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((r) => (
                  <tr key={r.id} onClick={() => setDetail(r)} className="cursor-pointer hover:bg-bg-panel/50 border-b border-bg-border/50">
                    <td className="py-2 pr-4 text-slate-400">{r.timestamp}</td>
                    <td className="py-2 pr-4 font-mono">{r.source_ip}</td>
                    <td className="py-2 pr-4 font-mono">{r.destination_ip}</td>
                    <td className="py-2 pr-4"><ProtocolBadge protocol={r.protocol} /></td>
                    <td className="py-2 pr-4"><SeverityBadge severity={r.model_severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail && (
        <Card title={`Record #${detail.id}`}>
          <div className="space-y-2 text-sm">
            <Row label="Timestamp" value={detail.timestamp} />
            <Row label="Source IP" value={detail.source_ip} mono />
            <Row label="Destination IP" value={detail.destination_ip} mono />
            <Row label="Protocol" value={<ProtocolBadge protocol={detail.protocol} />} />
            <Row label="Source Port" value={detail.source_port} />
            <Row label="Destination Port" value={detail.destination_port} />
            <Row label="Flow Duration (ms)" value={detail.flow_duration_ms} />
            <Row label="Packets" value={detail.packets} />
            <Row label="Bytes" value={detail.bytes} />
            <Row label="Failed Connections" value={detail.failed_connections} />
            <Row label="Connection Rate / min" value={detail.connection_rate_per_min} />
            <Row label="Anomaly Score" value={detail.model_anomaly_score} />
            <Row label="Severity" value={<SeverityBadge severity={detail.model_severity} />} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between border-b border-bg-border/50 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={mono ? "font-mono text-slate-200" : "text-slate-200"}>{value}</span>
    </div>
  );
}
