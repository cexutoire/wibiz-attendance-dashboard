import axios from 'axios';
import type { AttendanceRecord, WeekSummary, Task, Stats } from './types';

const API_BASE_URL = 'https://db-attendance-and-task-tracking.vercel.app';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchTodayAttendance = async (): Promise<AttendanceRecord[]> => {
  const response = await api.get('/api/attendance/today');
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