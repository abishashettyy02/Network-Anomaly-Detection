import axios from "axios";

export const API_BASE =
  `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api`;

export const api = axios.create({ baseURL: API_BASE });

export const getHealth = () => api.get("/health").then((r) => r.data);
export const getOverview = () => api.get("/overview").then((r) => r.data);
export const getTraffic = (params) => api.get("/traffic", { params }).then((r) => r.data);
export const getAnomalies = (params) => api.get("/anomalies", { params }).then((r) => r.data);
export const getAnomalyDetail = (id) => api.get(`/anomalies/${id}`).then((r) => r.data);
export const getModelInfo = () => api.get("/model").then((r) => r.data);
export const uploadDataset = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/dataset/upload", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
