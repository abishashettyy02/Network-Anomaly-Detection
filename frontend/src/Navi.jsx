import { useEffect, useRef, useState } from "react";
import { getOverview, getModelInfo, getAnomalies, getAnomalyDetail } from "./api";

// Short glossary for raw network fields, used to answer "what does X mean" style
// questions. This is static explanatory text, not a metric, so it is safe to
// keep as a fixed lookup rather than pulling it from the API.
const FIELD_GLOSSARY = {
  timestamp: "Timestamp — when the network flow/event was recorded.",
  source_ip: "Source IP — the IP address the traffic originated from.",
  destination_ip: "Destination IP — the IP address the traffic was sent to.",
  protocol: "Protocol — the network protocol used for the flow (e.g. TCP, UDP, ICMP).",
  source_port: "Source Port — the port number on the sending host.",
  destination_port: "Destination Port — the port number on the receiving host.",
  flow_duration_ms: "Flow Duration (ms) — how long the connection/flow lasted, in milliseconds.",
  packets: "Packets — number of packets exchanged during the flow.",
  bytes: "Bytes — total bytes transferred during the flow.",
  failed_connections: "Failed Connections — number of failed connection attempts associated with the flow.",
  connection_rate_per_min: "Connection Rate / min — how many connections per minute were seen from the same source around that time.",
};

const ANOMALY_DISCLAIMER =
  "Remember: a flagged record means the model found traffic that statistically differs from the rest of the dataset — it is unusual traffic, not a confirmed attack.";

function formatOverviewSummary(o) {
  return (
    `Total events: ${o.total_events}\n` +
    `Normal traffic: ${o.normal_traffic}\n` +
    `Anomalies: ${o.anomalies}\n` +
    `High-anomaly events: ${o.high_risk_events}`
  );
}

function formatProtocols(o) {
  return o.protocol_distribution
    .map((p) => `${p.protocol}: ${p.count} (${p.percentage}%)`)
    .join("\n");
}

function formatTopIps(list) {
  return list.map((r) => `${r.ip} — ${r.count} events`).join("\n");
}

function formatRecentAnomalies(o) {
  if (o.recent_anomalies.length === 0) return "No anomalies recorded yet.";
  return o.recent_anomalies
    .map(
      (a) =>
        `#${a.id} [${a.model_severity}] ${a.source_ip} → ${a.destination_ip} (${a.protocol}), score ${a.model_anomaly_score}, ${a.timestamp}`
    )
    .join("\n");
}

async function formatAnomalyDetail(id) {
  try {
    const d = await getAnomalyDetail(id);
    if (!d.is_anomaly) {
      return `Record #${id} exists but was NOT flagged as anomalous by the model (severity: ${d.model_severity}).`;
    }
    return (
      `Anomaly #${d.id} — severity ${d.model_severity}, score ${d.model_anomaly_score}\n` +
      `${d.source_ip}:${d.source_port} → ${d.destination_ip}:${d.destination_port} (${d.protocol})\n` +
      `Duration: ${d.flow_duration_ms}ms, Packets: ${d.packets}, Bytes: ${d.bytes}, ` +
      `Failed connections: ${d.failed_connections}, Rate/min: ${d.connection_rate_per_min}\n` +
      `Time: ${d.timestamp}\n${ANOMALY_DISCLAIMER}`
    );
  } catch {
    return `I couldn't find a record with ID ${id}. Try a different ID from the Anomalies or Investigation page.`;
  }
}

async function findAnomalyByIp(ip) {
  try {
    const res = await getAnomalies({ search: ip, limit: 5 });
    if (res.records.length === 0) return `No anomalies found involving ${ip}.`;
    return (
      `Found ${res.total} anomal${res.total === 1 ? "y" : "ies"} involving ${ip}. Showing up to 5:\n` +
      res.records
        .map((r) => `#${r.id} [${r.model_severity}] ${r.source_ip} → ${r.destination_ip} (${r.protocol})`)
        .join("\n") +
      `\n${ANOMALY_DISCLAIMER}`
    );
  } catch {
    return "I couldn't reach the anomalies API right now, so I can't search by IP.";
  }
}

const HELP_TEXT =
  "I can answer from the current dashboard data:\n" +
  "• total events / anomaly count & rate\n" +
  "• common protocols\n" +
  "• top source / destination IPs\n" +
  "• recent anomalies\n" +
  "• a specific anomaly by ID (e.g. \"anomaly 42\")\n" +
  "• anomalies for an IP (e.g. \"anomalies from 192.168.1.24\")\n" +
  "• the model & features it uses\n" +
  "• how Isolation Forest works\n" +
  "• what a field like flow_duration_ms means";

const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
const NUM_REGEX = /\b\d+\b/;

export default function Navi() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi, I'm NAVI, your network assistant. Ask me about events, anomalies, IPs, or the detection model. Type \"help\" for examples." },
  ]);
  const [input, setInput] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [modelError, setModelError] = useState(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open || overview || overviewError) return;
    getOverview().then(setOverview).catch((e) => setOverviewError(e.message));
    getModelInfo().then(setModelInfo).catch((e) => setModelError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const pushMessage = (msg) => setMessages((m) => [...m, msg]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    pushMessage({ role: "user", text });
    setBusy(true);
    const reply = await answer(text);
    pushMessage({ role: "assistant", text: reply });
    setBusy(false);
  };

  const answer = async (raw) => {
    const q = raw.toLowerCase();

    if (/^(hi|hello|hey)\b/.test(q)) {
      return "Hello! Ask me about events, anomalies, IPs, protocols, or the detection model.";
    }
    if (q.includes("help") || q === "?") {
      return HELP_TEXT;
    }

    // Specific anomaly detail by ID
    if (/\b(anomaly|record|event|id|#)\b/.test(q) && NUM_REGEX.test(q) && !IP_REGEX.test(q)) {
      const id = parseInt(q.match(NUM_REGEX)[0], 10);
      return formatAnomalyDetail(id);
    }

    // Anomalies involving a specific IP
    if (IP_REGEX.test(q)) {
      const ip = q.match(IP_REGEX)[0];
      return findAnomalyByIp(ip);
    }

    // Field glossary lookup
    for (const field of Object.keys(FIELD_GLOSSARY)) {
      const spaced = field.replace(/_/g, " ");
      if (q.includes(field) || q.includes(spaced)) {
        return FIELD_GLOSSARY[field];
      }
    }

    if (!overview && !overviewError) {
      return "I'm still loading the current dashboard data, one moment and try again.";
    }
    if (overviewError) {
      return `I can't reach the dashboard API right now (${overviewError}), so I can't pull live data for that.`;
    }

    if (q.includes("high risk") || q.includes("high-risk") || q.includes("critical")) {
      return `There are currently ${overview.high_risk_events} high/critical severity events out of ${overview.anomalies} total anomalies. ${ANOMALY_DISCLAIMER}`;
    }

    if (/(total|how many).*(event|record|traffic)/.test(q) || q.includes("total events")) {
      return `There are currently ${overview.total_events} total events (${overview.normal_traffic} normal, ${overview.anomalies} anomalies).`;
    }

    if (q.includes("rate")) {
      const rate = overview.total_events > 0 ? ((overview.anomalies / overview.total_events) * 100).toFixed(2) : "0.00";
      return `Anomaly rate is ${rate}% (${overview.anomalies} of ${overview.total_events} events). ${ANOMALY_DISCLAIMER}`;
    }

    if (q.includes("anomal")) {
      return `${overview.anomalies} anomalies detected out of ${overview.total_events} total events (${overview.high_risk_events} high/critical). ${ANOMALY_DISCLAIMER}`;
    }

    if (q.includes("protocol")) {
      return `Protocol breakdown:\n${formatProtocols(overview)}`;
    }

    if (q.includes("source ip") || (q.includes("source") && q.includes("top"))) {
      return `Top source IPs:\n${formatTopIps(overview.top_source_ips)}`;
    }

    if (q.includes("destination ip") || (q.includes("destination") && q.includes("top"))) {
      return `Top destination IPs:\n${formatTopIps(overview.top_destination_ips)}`;
    }

    if (q.includes("recent")) {
      return `Recent anomalies:\n${formatRecentAnomalies(overview)}\n${ANOMALY_DISCLAIMER}`;
    }

    if (q.includes("isolation forest") || q.includes("how does it work") || q.includes("how does the model") || q.includes("algorithm")) {
      return (
        "Isolation Forest builds many random decision trees that split traffic " +
        "features at random values. Records that are easy to separate from the " +
        "rest end up isolated in very few splits, giving them a short average " +
        "path length across the trees — that signal is turned into an anomaly " +
        `score, and the highest-scoring records get flagged. ${ANOMALY_DISCLAIMER}`
      );
    }

    if (q.includes("feature") || q.includes("model") || q.includes("excluded")) {
      if (!modelInfo && !modelError) return "Still loading model details, try again in a moment.";
      if (modelError) return `I can't reach the model info API right now (${modelError}).`;
      return (
        `Model: ${modelInfo.model_name} (unsupervised).\n` +
        `Features used: ${modelInfo.features_used.join(", ")}\n` +
        `Excluded fields: ${modelInfo.excluded_columns.join(", ") || "none present in this dataset"}\n` +
        `Trained on ${modelInfo.training_records} records, ${modelInfo.detected_anomalies} flagged as anomalies.`
      );
    }

    if (q.includes("overview") || q.includes("summary") || q.includes("stats")) {
      return formatOverviewSummary(overview);
    }

    return "I didn't quite catch that. Type \"help\" to see what I can answer using the current dashboard data.";
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-bg-card border border-accent-cyan/40 text-accent-cyan rounded-full pl-3 pr-4 py-2.5 shadow-lg hover:bg-accent-cyan/10 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></span>
        <span className="text-sm font-semibold">NAVI</span>
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-80 max-w-[92vw] bg-bg-card border border-bg-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border bg-bg-panel">
            <div>
              <p className="text-sm font-semibold text-accent-cyan">NAVI</p>
              <p className="text-[11px] text-slate-500">Network Assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 max-h-80 min-h-[220px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`whitespace-pre-line text-xs rounded-lg px-2.5 py-2 max-w-[85%] ${
                    m.role === "user"
                      ? "bg-accent-blue/20 text-slate-100 border border-accent-blue/30"
                      : "bg-bg-panel text-slate-300 border border-bg-border"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <p className="text-[11px] text-slate-500">NAVI is checking the data...</p>}
          </div>

          <div className="flex gap-2 p-2 border-t border-bg-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about events, anomalies, IPs..."
              className="flex-1 bg-bg-panel border border-bg-border rounded px-2 py-1.5 text-xs"
            />
            <button
              onClick={handleSend}
              disabled={busy}
              className="bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded px-3 py-1.5 text-xs hover:bg-accent-cyan/30 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
