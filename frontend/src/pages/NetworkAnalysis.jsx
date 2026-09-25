import { useEffect, useState } from "react";
import { getTraffic } from "../api";
import { Card, SeverityBadge, ProtocolBadge } from "../components";

export default function NetworkAnalysis() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [protocol, setProtocol] = useState("");
  const [sourceIp, setSourceIp] = useState("");
  const [destIp, setDestIp] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    getTraffic({
      protocol: protocol || undefined,
      source_ip: sourceIp || undefined,
      destination_ip: destIp || undefined,
      limit: 100,
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
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Protocol</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
                    className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Source IP</label>
            <input value={sourceIp} onChange={(e) => setSourceIp(e.target.value)}
                   placeholder="192.168.1.x"
                   className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm w-40" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Destination IP</label>
            <input value={destIp} onChange={(e) => setDestIp(e.target.value)}
                   placeholder="10.0.0.x"
                   className="bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-sm w-40" />
          </div>
          <button onClick={fetchData}
                  className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40 rounded px-3 py-1.5 text-sm hover:bg-accent-blue/30">
            Apply Filters
          </button>
          <span className="text-xs text-slate-500 ml-auto">{total} matching records</span>
        </div>
      </Card>

      <Card title={`Traffic Log (showing up to 100 of ${total})`}>
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-card">
              <tr className="text-left text-slate-500 border-b border-bg-border">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Destination</th>
                <th className="py-2 pr-4">Protocol</th>
                <th className="py-2 pr-4">Ports</th>
                <th className="py-2 pr-4">Duration (ms)</th>
                <th className="py-2 pr-4">Packets</th>
                <th className="py-2 pr-4">Bytes</th>
                <th className="py-2 pr-4">Failed</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-6 text-center text-slate-500">Loading...</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="border-b border-bg-border/50 hover:bg-bg-panel/50">
                  <td className="py-2 pr-4 text-slate-400">{r.timestamp}</td>
                  <td className="py-2 pr-4 font-mono">{r.source_ip}</td>
                  <td className="py-2 pr-4 font-mono">{r.destination_ip}</td>
                  <td className="py-2 pr-4"><ProtocolBadge protocol={r.protocol} /></td>
                  <td className="py-2 pr-4 text-slate-400">{r.source_port} → {r.destination_port}</td>
                  <td className="py-2 pr-4">{r.flow_duration_ms}</td>
                  <td className="py-2 pr-4">{r.packets}</td>
                  <td className="py-2 pr-4">{r.bytes}</td>
                  <td className="py-2 pr-4">{r.failed_connections}</td>
                  <td className="py-2 pr-4">
                    {r.is_anomaly ? <SeverityBadge severity={r.model_severity} /> : <span className="text-risk-low text-xs">Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
