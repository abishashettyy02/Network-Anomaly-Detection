import { useEffect, useState } from "react";
import { getAnomalies, getAnomalyDetail } from "../api";
import { Card, SeverityBadge, ProtocolBadge } from "../components";

function InvestigationPanel({ id, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    getAnomalyDetail(id).then(setDetail);
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-bg-border rounded-lg p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-accent-cyan font-semibold">Anomaly Investigation — #{id}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        {!detail ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Severity</span>
              <SeverityBadge severity={detail.model_severity} />
            </div>
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
            <Row label="Status" value={detail.is_anomaly ? "Anomalous" : "Normal"} />
          </div>
        )}
      </div>
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

export default function Anomalies() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ severity: "", protocol: "", search: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    getAnomalies({
      severity: filters.severity || undefined,
      protocol: filters.protocol || undefined,
      search: filters.search || undefined,
      limit: 150,
    })
      .then((d) => {
        setRecords(d.records);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.severity, filters.protocol]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Severity</label>
            <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                    className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Protocol</label>
            <select value={filters.protocol} onChange={(e) => setFilters({ ...filters, protocol: e.target.value })}
                    className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Search (IP / protocol)</label>
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              placeholder="e.g. 192.168.1.24"
              className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm w-full"
            />
          </div>
          <button onClick={fetchData}
                  className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40 rounded px-3 py-1.5 text-sm hover:bg-accent-blue/30">
            Search
          </button>
          <span className="text-xs text-slate-500 ml-auto">{total} anomalies</span>
        </div>
      </Card>

      <Card title="Anomalies (click a row to investigate)">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-card">
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
              {loading ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">No matching anomalies</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} onClick={() => setSelectedId(r.id)}
                    className="border-b border-bg-border/50 hover:bg-bg-panel/50 cursor-pointer">
                  <td className="py-2 pr-4 text-slate-400">{r.timestamp}</td>
                  <td className="py-2 pr-4 font-mono">{r.source_ip}</td>
                  <td className="py-2 pr-4 font-mono">{r.destination_ip}</td>
                  <td className="py-2 pr-4"><ProtocolBadge protocol={r.protocol} /></td>
                  <td className="py-2 pr-4">{r.model_anomaly_score}</td>
                  <td className="py-2 pr-4"><SeverityBadge severity={r.model_severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedId !== null && (
        <InvestigationPanel id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
