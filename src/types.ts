export interface AttendanceRecord {
  name: string;
  time_in: string | null;
  time_out: string | null;
  break_start: string | null;
  break_end: string | null;
  break_duration: number | null;
  hours_worked: number | null;
  status: string;
}

export interface WeekSummary {
  name: string;
  total_hours: number;
  days_worked: number;
}

export interface Task {
  name: string;
  task: string;
  url: string | null;
  created_at: string;
}

export interface Stats {
  total_attendance: number;
  total_tasks: number;
  total_hours: number;
  week_hours: number;
  currently_working: number;
  on_break: number;
}