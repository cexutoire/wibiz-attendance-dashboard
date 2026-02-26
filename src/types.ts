// export interface AttendanceRecord {
//   name: string;
//   time_in: string | null;
//   time_out: string | null;
//   break_start: string | null;
//   break_end: string | null;
//   break_duration: number | null;
//   hours_worked: number | null;
//   status: string;
// }

// export interface WeekSummary {
//   name: string;
//   total_hours: number;
//   days_worked: number;
// }

// export interface Task {
//   name: string;
//   task: string;
//   url: string | null;
//   created_at: string;
// }

// export interface Stats {
//   total_attendance: number;
//   total_tasks: number;
//   total_hours: number;
//   week_hours: number;
//   currently_working: number;
//   on_break: number;
// }

export interface AttendanceRecord {
  name: string;
  date?: string;
  time_in?: string;
  time_out?: string;
  break_start?: string;       // new
  break_end?: string;         // new
  break_duration?: number;
  hours_worked?: number;
  status: string;
  late?: boolean;           // new: flag late arrivals
  undertime?: boolean;      // new: flag undertime
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

export interface AttendanceCount {
  date: string;
  total_staff: number;
  present_count: number;
  absent_count: number;
  present: { name: string; role: string }[];
  absent: { name: string; role: string; consecutive_absences?: number }[]; // new: streak
}

export interface DailySummary {
  date: string;
  staff_count: number;
  total_hours: number;
  completed: number;
  still_working: number;
}

export interface WeeklySummary {
  week: string;
  week_start: string;
  week_end: string;
  unique_staff: number;
  days_worked: number;
  total_hours: number;
  avg_hours_per_day: number;
}

export interface MonthlySummary {
  month: string;
  month_name: string;
  unique_staff: number;
  days_worked: number;
  total_hours: number;
  avg_hours_per_day: number;
  total_break_hours: number;
  absent_days?: number;       // new
  late_count?: number;        // new
}