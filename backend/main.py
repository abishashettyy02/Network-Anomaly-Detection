"""
Network Anomaly Detection - FastAPI backend.
Single-file backend by design (project brief: minimize file count).
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import os

app = FastAPI(title="Network Anomaly Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "network_anamoly_dataset.csv")

RAW_FEATURE_COLS = [
    "protocol", "source_port", "destination_port", "flow_duration_ms",
    "packets", "bytes", "failed_connections", "connection_rate_per_min",
]
# One-hot protocol categories. LabelEncoder previously assigned TCP/UDP/ICMP
# ordinal codes (0/1/2), which implies a false ordering the model can exploit.
# Unknown protocol values fall into a fixed "OTHER" bucket so the feature
# columns are always the same shape regardless of what a given upload contains.
KNOWN_PROTOCOLS = ["TCP", "UDP", "ICMP"]
PROTOCOL_ONEHOT_COLS = [f"protocol_{p}" for p in KNOWN_PROTOCOLS + ["OTHER"]]
NUMERIC_FEATURE_COLS = [
    "source_port", "destination_port", "flow_duration_ms",
    "packets", "bytes", "failed_connections", "connection_rate_per_min",
]
ML_INPUT_COLS = PROTOCOL_ONEHOT_COLS + NUMERIC_FEATURE_COLS
EXCLUDED_COLS = ["label", "anomaly_score", "severity"]  # excluded if present; current dataset has none of these

# Isolation Forest contamination, fixed rather than "auto". contamination="auto"
# applies a static decision-function offset from the original Isolation Forest
# paper -- it is NOT a percentile target, and on some feature distributions/
# dataset sizes it can flag a large, unstable share of records as anomalous
# (observed ~68% on a 12k-row dataset). A fixed contamination gives a
# predictable, tunable "assumed anomaly rate" -- standard practice for
# unsupervised anomaly detection when there is no labeled ground truth to
# calibrate against. 5% is a common starting assumption for network traffic;
# adjust this single constant to retune.
CONTAMINATION = 0.05

# In-memory state populated by load_and_process()
STATE = {
    "df": None,           # processed dataframe with predictions
    "model": None,
    "loaded": False,
    "source": None,       # "default" or "upload"
}


def load_and_process(csv_path: str):
    """Load CSV, validate, clean, encode, run Isolation Forest, store results."""
    df = pd.read_csv(csv_path)

    required = ["timestamp", "source_ip", "destination_ip"] + RAW_FEATURE_COLS
    missing_cols = [c for c in required if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    # Drop rows with missing values in required feature columns (dataset had none,
    # but this keeps uploads robust).
    before = len(df)
    df = df.dropna(subset=["timestamp", "source_ip", "destination_ip"] + RAW_FEATURE_COLS).reset_index(drop=True)
    dropped = before - len(df)

    # Coerce numeric feature columns; drop rows that fail to coerce.
    numeric_cols = ["source_port", "destination_port", "flow_duration_ms",
                     "packets", "bytes", "failed_connections", "connection_rate_per_min"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    before2 = len(df)
    df = df.dropna(subset=numeric_cols).reset_index(drop=True)
    dropped += before2 - len(df)

    # One-hot encode protocol (categorical -> binary indicator columns, no
    # ordinal relationship implied between categories) for ML input only.
    protocol_clean = df["protocol"].where(df["protocol"].isin(KNOWN_PROTOCOLS), "OTHER")
    protocol_dummies = pd.get_dummies(protocol_clean, prefix="protocol").astype(int)
    for col in PROTOCOL_ONEHOT_COLS:
        if col not in protocol_dummies.columns:
            protocol_dummies[col] = 0
    df[PROTOCOL_ONEHOT_COLS] = protocol_dummies[PROTOCOL_ONEHOT_COLS]

    X = df[ML_INPUT_COLS].values

    model = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        random_state=42,
    )
    model.fit(X)

    raw_scores = model.decision_function(X)  # higher = more normal
    predictions = model.predict(X)  # -1 anomaly, 1 normal -- the ONLY source of anomaly status

    # Convert decision_function output into a 0-1 "anomaly score" (higher = more anomalous)
    # by inverting and min-max scaling.
    inverted = -raw_scores
    min_v, max_v = inverted.min(), inverted.max()
    if max_v - min_v > 1e-9:
        model_anomaly_score = (inverted - min_v) / (max_v - min_v)
    else:
        model_anomaly_score = np.zeros_like(inverted)

    df["is_anomaly"] = predictions == -1
    df["model_anomaly_score"] = model_anomaly_score.round(4)

    def severity_from_score(row):
        # Severity is a heuristic bucketing of the model's own anomaly score,
        # applied ONLY to records already flagged anomalous by predict(). It
        # is not a verified or confirmed threat/risk level -- there is no
        # labeled ground truth in this dataset to validate it against.
        if not row["is_anomaly"]:
            return "Low"
        s = row["model_anomaly_score"]
        if s >= 0.85:
            return "Critical"
        elif s >= 0.7:
            return "High"
        else:
            return "Medium"

    df["model_severity"] = df.apply(severity_from_score, axis=1)
    df["id"] = df.index.astype(int)

    STATE["df"] = df
    STATE["model"] = model
    STATE["loaded"] = True
    STATE["rows_dropped"] = dropped
    STATE["training_records"] = len(df)

    return {"rows": len(df), "dropped": dropped, "anomalies": int(df["is_anomaly"].sum())}


@app.on_event("startup")
def startup_load_default_dataset():
    if os.path.exists(DATA_PATH):
        try:
            result = load_and_process(DATA_PATH)
            STATE["source"] = "default"
            print(f"Loaded default dataset: {result}")
        except Exception as e:
            print(f"Failed to load default dataset: {e}")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "network-anomaly-detection-api"}


def _require_loaded():
    if not STATE["loaded"] or STATE["df"] is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded")


@app.post("/api/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")
    tmp_path = os.path.join(os.path.dirname(__file__), "_uploaded_tmp.csv")
    contents = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(contents)
    try:
        result = load_and_process(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process dataset: {e}")
    STATE["source"] = "upload"
    return {"status": "ok", **result}


@app.get("/api/overview")
def overview():
    _require_loaded()
    df = STATE["df"]
    total = len(df)
    normal = int((~df["is_anomaly"]).sum())
    anomalies = int(df["is_anomaly"].sum())
    high_risk = int((df["model_severity"].isin(["High", "Critical"])).sum())

    # Time-bucketed timeline -- never plot all raw records individually.
    # Bucket width adapts to the dataset's time span so charts stay readable
    # regardless of dataset size: 15-min buckets for <=1 day of data, hourly
    # for <=14 days, daily beyond that.
    ts = pd.to_datetime(df["timestamp"], errors="coerce")
    span = ts.max() - ts.min() if ts.notna().any() else pd.Timedelta(0)
    if span <= pd.Timedelta(days=1):
        bucket_freq, bucket_label = "15min", "15 min"
    elif span <= pd.Timedelta(days=14):
        bucket_freq, bucket_label = "1h", "1 hour"
    else:
        bucket_freq, bucket_label = "1D", "1 day"

    timeline_df = (
        df.assign(_bucket=ts.dt.floor(bucket_freq))
        .groupby("_bucket")
        .agg(total=("id", "count"), anomalies=("is_anomaly", "sum"))
        .reset_index()
        .sort_values("_bucket")
    )
    timeline_df["anomaly_rate"] = (timeline_df["anomalies"] / timeline_df["total"] * 100).round(2)
    timeline_df["bucket"] = timeline_df["_bucket"].dt.strftime("%Y-%m-%d %H:%M")
    timeline = timeline_df[["bucket", "total", "anomalies", "anomaly_rate"]].to_dict(orient="records")

    protocol_distribution = df["protocol"].value_counts().reset_index()
    protocol_distribution.columns = ["protocol", "count"]
    protocol_distribution["percentage"] = (protocol_distribution["count"] / total * 100).round(1)
    protocol_distribution = protocol_distribution.to_dict(orient="records")

    top_source_ips = (
        df["source_ip"].value_counts().head(5).reset_index()
    )
    top_source_ips.columns = ["ip", "count"]
    top_source_ips = top_source_ips.to_dict(orient="records")

    top_dest_ips = (
        df["destination_ip"].value_counts().head(5).reset_index()
    )
    top_dest_ips.columns = ["ip", "count"]
    top_dest_ips = top_dest_ips.to_dict(orient="records")

    recent_anomalies = (
        df[df["is_anomaly"]]
        .sort_values("timestamp", ascending=False)
        .head(5)[["id", "timestamp", "source_ip", "destination_ip", "protocol", "model_anomaly_score", "model_severity"]]
        .to_dict(orient="records")
    )

    return {
        "total_events": total,
        "normal_traffic": normal,
        "anomalies": anomalies,
        "high_risk_events": high_risk,
        "timeline": timeline,
        "timeline_bucket_label": bucket_label,
        "protocol_distribution": protocol_distribution,
        "top_source_ips": top_source_ips,
        "top_destination_ips": top_dest_ips,
        "recent_anomalies": recent_anomalies,
        "source": STATE["source"],
    }


@app.get("/api/traffic")
def traffic(
    protocol: str | None = None,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    limit: int = 200,
    offset: int = 0,
):
    _require_loaded()
    df = STATE["df"]
    filtered = df
    if protocol:
        filtered = filtered[filtered["protocol"] == protocol]
    if source_ip:
        filtered = filtered[filtered["source_ip"] == source_ip]
    if destination_ip:
        filtered = filtered[filtered["destination_ip"] == destination_ip]

    cols = ["id", "timestamp", "source_ip", "destination_ip", "protocol",
            "source_port", "destination_port", "flow_duration_ms", "packets",
            "bytes", "failed_connections", "connection_rate_per_min",
            "is_anomaly", "model_anomaly_score", "model_severity"]
    total = len(filtered)
    page = filtered.sort_values("timestamp")[cols].iloc[offset: offset + limit]
    return {"total": total, "count": len(page), "records": page.to_dict(orient="records")}


@app.get("/api/anomalies")
def anomalies(
    protocol: str | None = None,
    severity: str | None = None,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    port: int | None = None,
    search: str | None = None,
    limit: int = 200,
    offset: int = 0,
):
    _require_loaded()
    df = STATE["df"]
    filtered = df[df["is_anomaly"]]

    if protocol:
        filtered = filtered[filtered["protocol"] == protocol]
    if severity:
        filtered = filtered[filtered["model_severity"] == severity]
    if source_ip:
        filtered = filtered[filtered["source_ip"] == source_ip]
    if destination_ip:
        filtered = filtered[filtered["destination_ip"] == destination_ip]
    if port is not None:
        filtered = filtered[(filtered["source_port"] == port) | (filtered["destination_port"] == port)]
    if search:
        s = search.lower()
        mask = (
            filtered["source_ip"].str.lower().str.contains(s)
            | filtered["destination_ip"].str.lower().str.contains(s)
            | filtered["protocol"].str.lower().str.contains(s)
        )
        filtered = filtered[mask]

    cols = ["id", "timestamp", "source_ip", "destination_ip", "protocol",
            "source_port", "destination_port", "flow_duration_ms", "packets",
            "bytes", "failed_connections", "connection_rate_per_min",
            "model_anomaly_score", "model_severity"]
    total = len(filtered)
    page = filtered.sort_values("model_anomaly_score", ascending=False)[cols].iloc[offset: offset + limit]
    return {"total": total, "count": len(page), "records": page.to_dict(orient="records")}


@app.get("/api/anomalies/{record_id}")
def anomaly_detail(record_id: int):
    _require_loaded()
    df = STATE["df"]
    row = df[df["id"] == record_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Record not found")
    cols = ["id", "timestamp", "source_ip", "destination_ip", "protocol",
            "source_port", "destination_port", "flow_duration_ms", "packets",
            "bytes", "failed_connections", "connection_rate_per_min",
            "is_anomaly", "model_anomaly_score", "model_severity"]
    return row[cols].to_dict(orient="records")[0]


@app.get("/api/model")
def model_info():
    _require_loaded()
    df = STATE["df"]
    model = STATE["model"]
    info = {
        "model_name": "Isolation Forest",
        "library": "scikit-learn",
        "features_used": ML_INPUT_COLS,
        "excluded_columns": EXCLUDED_COLS,
        "training_records": STATE["training_records"],
        "detected_anomalies": int(df["is_anomaly"].sum()),
        "rows_dropped_in_cleaning": STATE["rows_dropped"],
        "model_settings": {
            "n_estimators": model.n_estimators,
            "contamination": model.contamination,
            "random_state": model.random_state,
        },
        "dataset_source": STATE["source"],
        "unsupervised": True,
        "ground_truth_available": False,
        "note": (
            "This dataset has no label/anomaly_score/severity columns. Detection is "
            "fully unsupervised: Isolation Forest's predict() output is the only "
            "source of anomaly status (contamination is a fixed, tunable assumed "
            "anomaly rate, not a target derived from real attack data). Severity "
            "(Medium/High/Critical) is a post-hoc heuristic derived from the "
            "model's own anomaly score for already-flagged anomalies -- it is not "
            "a verified or confirmed threat level. Metrics such as precision/"
            "recall/F1/ROC-AUC are not shown because there is no validated ground "
            "truth to compute them against."
        ),
    }
    return info
