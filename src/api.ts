// import axios, { AxiosError } from "axios";
// import type { AttendanceRecord, WeekSummary, Task, Stats } from "./types";

// // Always use an empty base URL so every request goes through the Vite dev
// // proxy (/api → http://localhost:8000).  The VITE_API_URL env var is consumed
// // only by vite.config.ts (server-side) and is never inlined into this bundle.
// const api = axios.create({
//   baseURL: "",
//   timeout: 10_000,
//   headers: { "Content-Type": "application/json" },
// });

// // Surfaces human-readable error messages to the UI toast
// api.interceptors.response.use(
//   (res) => res,
//   (err: AxiosError) => {
//     if (err.code === "ECONNABORTED") {
//       return Promise.reject(
//         new Error("Request timed out. Check the API server."),
//       );
//     }
//     if (err.code === "ERR_NETWORK" || !err.response) {
//       return Promise.reject(
//         new Error("Cannot reach API server — is it running on port 8000?"),
//       );
//     }
//     const status = err.response.status;
//     if (status === 404)
//       return Promise.reject(
//         new Error(`404: endpoint not found — ${err.config?.url}`),
//       );
//     if (status === 500)
//       return Promise.reject(new Error("500: internal server error"));
//     return Promise.reject(err);
//   },
// );

// // /api/attendance/today  →  { data: AttendanceRecord[] }
// export const fetchTodayAttendance = async (): Promise<AttendanceRecord[]> => {
//   const res = await api.get<{ data: AttendanceRecord[] }>(
//     "/api/attendance/today",
//   );
//   return res.data.data;
// };

// // /api/attendance/week  →  { data: WeekSummary[] }
// export const fetchWeekSummary = async (): Promise<WeekSummary[]> => {
//   const res = await api.get<{ data: WeekSummary[] }>("/api/attendance/week");
//   return res.data.data;
// };

// // /api/tasks/today  →  { data: Task[] }
// export const fetchTodayTasks = async (): Promise<Task[]> => {
//   const res = await api.get<{ data: Task[] }>("/api/tasks/today");
//   return res.data.data;
// };

// // /api/stats  →  flat Stats object (no wrapper)
// export const fetchStats = async (): Promise<Stats> => {
//   const res = await api.get<Stats>("/api/stats");
//   return res.data;
// };
import axios from 'axios';
import type { 
  AttendanceRecord, WeekSummary, Task, Stats, AttendanceCount,
  DailySummary, WeeklySummary, MonthlySummary 
} from './types';

const API_BASE_URL = 'https://db-attendance-and-task-tracking.vercel.app';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchTodayAttendance = async (): Promise<AttendanceRecord[]> => {
  const response = await api.get('/api/attendance/today');
  return response.data.data;
};

export const fetchAttendanceCount = async (): Promise<AttendanceCount> => {
  const response = await api.get('/api/attendance/count');
  return response.data;
};

export const fetchDailySummary = async (): Promise<DailySummary[]> => {
  const response = await api.get('/api/attendance/summary/daily');
  return response.data.data;
};

export const fetchWeeklySummary = async (): Promise<WeeklySummary[]> => {
  const response = await api.get('/api/attendance/summary/weekly');
  return response.data.data;
};

export const fetchMonthlySummary = async (): Promise<MonthlySummary[]> => {
  const response = await api.get('/api/attendance/summary/monthly');
  return response.data.data;
};

export const fetchWeekSummary = async (): Promise<WeekSummary[]> => {
  const response = await api.get('/api/attendance/week');
  return response.data.data;
};

export const fetchTodayTasks = async (): Promise<Task[]> => {
  const response = await api.get('/api/tasks/today');
  return response.data.data;
};

export const fetchStats = async (): Promise<Stats> => {
  const response = await api.get('/api/stats');
  return response.data;
};