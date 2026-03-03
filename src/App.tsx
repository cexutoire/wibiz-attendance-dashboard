import { useState, useEffect, Fragment } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FileSpreadsheet,
  X,
  Download,
  Coffee,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Search,
  Filter,
  Moon,
  Sun,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  fetchTodayAttendance,
  fetchStats,
  fetchTodayTasks,
  fetchAttendanceCount,
  fetchWeeklySummary,
  fetchMonthlySummary,
} from "./api";
import type {
  AttendanceRecord,
  Task,
  Stats,
  AttendanceCount,
  WeeklySummary,
  MonthlySummary,
} from "./types";

// ─── Avatar helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100   text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100  text-amber-700",
  "bg-rose-100   text-rose-700",
  "bg-cyan-100   text-cyan-700",
  "bg-pink-100   text-pink-700",
  "bg-indigo-100 text-indigo-700",
];

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const color = getAvatarColor(name);
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-xs";
  return (
    <div
      className={`${sz} ${color} rounded-full flex items-center justify-center font-bold shrink-0 ring-2 ring-white`}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonTaskCard() {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="w-7 h-7 rounded-full animate-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded animate-shimmer" />
        <div className="h-3 w-2/3 rounded animate-shimmer" />
      </div>
    </div>
  );
}

// ─── Chart colors ───────────────────────────────────────────────────────────
const CHART_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    badge: string;
    dot: string;
    border: string;
    progress: string;
  }
> = {
  clocked_in: {
    label: "Working",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500 animate-pulse",
    border: "border-l-emerald-400",
    progress: "bg-emerald-400",
  },
  on_break: {
    label: "On Break",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-400",
    border: "border-l-amber-400",
    progress: "bg-amber-400",
  },
  complete: {
    label: "Done",
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
    border: "border-l-slate-300",
    progress: "bg-indigo-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.complete;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────────────
const TARGET_HOURS = 8;

function fmtHours(h?: number): string {
  if (!h || h <= 0) return "—";
  const totalMins = Math.round(h * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

// ─── Hours Progress Bar ──────────────────────────────────────────────────────
function HoursProgress({ hours, status }: { hours?: number; status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.complete;
  const pct = Math.min(((hours ?? 0) / TARGET_HOURS) * 100, 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Progress
        </span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
          {fmtHours(hours)} / {TARGET_HOURS}h
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.progress}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [attendanceCount, setAttendanceCount] =
    useState<AttendanceCount | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryTab, setSummaryTab] = useState<"weekly" | "monthly">("weekly");
  const [showPreview, setShowPreview] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [liveTime, setLiveTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "clocked_in" | "complete"
  >("all");
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  const tooltipStyle = dark
    ? {
        borderRadius: 12,
        border: "1px solid #334155",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
        backgroundColor: "#1e293b",
        color: "#e2e8f0",
      }
    : {
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,.08)",
      };

  const loadData = async () => {
    try {
      setLoading(true);
      const [attendance, statistics, tasks, count, weekly, monthly] =
        await Promise.all([
          fetchTodayAttendance(),
          fetchStats(),
          fetchTodayTasks(),
          fetchAttendanceCount(),
          fetchWeeklySummary(),
          fetchMonthlySummary(),
        ]);
      setTodayAttendance(attendance);
      setStats(statistics);
      setTodayTasks(tasks);
      setAttendanceCount(count);
      setWeeklySummaries(weekly);
      setMonthlySummaries(monthly);
      setCurrentDate(new Date());
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "API Offline — retrying…";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 300000); // refresh every 5 minutes
    const clockInterval = setInterval(() => setLiveTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const filteredAttendance = todayAttendance.filter((r) => {
    const matchesSearch = r.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formattedDate = currentDate.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const liveTimeStr = liveTime.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const downloadXLSX = () => {
    const wb = XLSX.utils.book_new();

    // ── Attendance sheet ──
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          "Member",
          "Time In",
          "Time Out",
          "Break Start",
          "Break End",
          "Break Duration",
          "Total Hours",
          "Status",
          "Late",
          "Undertime",
        ],
        ...todayAttendance.map((r) => [
          r.name,
          r.time_in || "-",
          r.time_out || "-",
          r.break_start || "-",
          r.break_end || "-",
          fmtHours(r.break_duration),
          fmtHours(r.hours_worked),
          r.status.toUpperCase(),
          r.late ? "YES" : "No",
          r.undertime ? "YES" : "No",
        ]),
      ]),
      "Attendance",
    );

    // ── Absent sheet ──
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Absent Staff", "Role", "Consecutive Absent Days"],
        ...(attendanceCount?.absent ?? []).map((s) => [
          s.name,
          s.role || "-",
          s.consecutive_absences ?? 1,
        ]),
      ]),
      "Absent Today",
    );

    // ── Task Report sheet ──
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Staff", "Task Detail", "Time", "Link"],
        ...todayTasks.map((t) => [
          t.name,
          t.task,
          new Date(t.created_at).toLocaleTimeString(),
          t.url || "-",
        ]),
      ]),
      "Task Report",
    );

    // ── Weekly Summary sheet ──
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          "Week",
          "Period",
          "Staff",
          "Days Worked",
          "Total Hours",
          "Avg hrs/day",
        ],
        ...weeklySummaries.map((w) => [
          w.week,
          `${w.week_start} – ${w.week_end}`,
          w.unique_staff,
          w.days_worked,
          w.total_hours.toFixed(1),
          w.avg_hours_per_day.toFixed(1),
        ]),
      ]),
      "Weekly Summary",
    );

    XLSX.writeFile(
      wb,
      `Attendance_Report_${currentDate.toISOString().split("T")[0]}.xlsx`,
    );
  };

  const presentCount = attendanceCount?.present_count ?? 0;
  const totalStaff = attendanceCount?.total_staff ?? 0;
  const attendanceRate =
    totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  const streakers = (attendanceCount?.absent ?? []).filter(
    (s) => (s.consecutive_absences ?? 0) >= 2,
  );
  const lateStaff = todayAttendance.filter((r) => r.late);
  const undertimeStaff = todayAttendance.filter(
    (r) => r.undertime && r.status === "complete",
  );
  const hasAlerts =
    streakers.length > 0 || lateStaff.length > 0 || undertimeStaff.length > 0;

  const statCards = [
    {
      label: "Present Today",
      value: attendanceCount?.present_count ?? 0,
      sub: attendanceCount ? `of ${attendanceCount.total_staff} staff` : "",
      icon: <Users className="w-5 h-5" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      ring: "ring-emerald-100",
      trend: attendanceRate >= 80 ? "up" : "down",
      trendLabel: `${attendanceRate}% rate`,
    },
    {
      label: "Absent Today",
      value: attendanceCount?.absent_count ?? 0,
      sub: attendanceCount ? `of ${attendanceCount.total_staff} staff` : "",
      icon: <Users className="w-5 h-5" />,
      color: "text-rose-600",
      bg: "bg-rose-50",
      ring: "ring-rose-100",
      trend: (attendanceCount?.absent_count ?? 0) === 0 ? "up" : "down",
      trendLabel:
        (attendanceCount?.absent_count ?? 0) === 0 ? "All in!" : "Check in",
    },
    {
      label: "Working Now",
      value: stats?.currently_working ?? 0,
      sub: "",
      icon: <Briefcase className="w-5 h-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50",
      ring: "ring-blue-100",
      trend: "up",
      trendLabel: "Active",
    },
    // {
    //   label: "On Break",
    //   value: stats?.on_break ?? 0,
    //   sub: "",
    //   icon: <Coffee className="w-5 h-5" />,
    //   color: "text-amber-600",
    //   bg: "bg-amber-50",
    //   ring: "ring-amber-100",
    //   trend: "neutral",
    //   trendLabel: "Resting",
    // },
    {
      label: "Weekly Hours",
      value: `${stats?.week_hours ?? 0}h`,
      sub: "",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      ring: "ring-indigo-100",
      trend: "up",
      trendLabel: "This week",
    },
    {
      label: "Today's Tasks",
      value: todayTasks.length,
      sub: "",
      icon: <CheckSquare className="w-5 h-5" />,
      color: "text-violet-600",
      bg: "bg-violet-50",
      ring: "ring-violet-100",
      trend: todayTasks.length > 0 ? "up" : "neutral",
      trendLabel: `${todayTasks.length} logged`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                Digital Benefits
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
                ATTENDANCE DASHBOARD
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-center pointer-events-none select-none">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {formattedDate}
            </span>
            <span className="text-base font-bold tabular-nums text-slate-700 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {liveTimeStr}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle — always visible */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setDark(false)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-all ${
                  !dark
                    ? "bg-white dark:bg-slate-600 text-amber-500 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                aria-label="Light mode"
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                onClick={() => setDark(true)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-all ${
                  dark
                    ? "bg-white dark:bg-slate-600 text-indigo-500 dark:text-indigo-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                aria-label="Dark mode"
              >
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="h-9 px-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {loading ? "Syncing…" : "Refresh"}
              </span>
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-fade-in">
        {/* ── Management Alert Banner ── */}
        {!loading && hasAlerts && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-4 flex flex-wrap gap-4 items-start">
            <div className="flex items-center gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Management Alerts
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {streakers.map((s, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full"
                >
                  {s.name} — {s.consecutive_absences}d absent streak
                </span>
              ))}
              {lateStaff.map((r, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full"
                >
                  {r.name} — Late today
                </span>
              ))}
              {undertimeStaff.map((r, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full"
                >
                  {r.name} — Undertime
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-200"
            >
              <div
                className={`w-10 h-10 ${card.bg} ring-1 ${card.ring} rounded-xl flex items-center justify-center mb-3`}
              >
                <span className={card.color}>{card.icon}</span>
              </div>
              <p
                className={`text-2xl font-bold tabular-nums leading-none ${card.color}`}
              >
                {card.value}
              </p>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
                {card.label}
              </p>
              {card.sub && (
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                  {card.sub}
                </p>
              )}
              <div className="flex items-center gap-1 mt-2">
                {card.trend === "up" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : card.trend === "down" ? (
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                ) : (
                  <span className="w-3 h-0.5 bg-slate-300 rounded-full inline-block" />
                )}
                <span
                  className={`text-[10px] font-semibold ${
                    card.trend === "up"
                      ? "text-emerald-500"
                      : card.trend === "down"
                        ? "text-rose-400"
                        : "text-slate-400"
                  }`}
                >
                  {card.trendLabel}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Attendance Count card ── */}
        {(attendanceCount || loading) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Attendance Count
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {attendanceCount?.date ?? "Today"}
                </p>
              </div>
              {!loading && attendanceCount && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Rate
                      </p>
                      <p
                        className={`text-base font-black tabular-nums ${
                          attendanceRate >= 80
                            ? "text-emerald-600"
                            : "text-rose-500"
                        }`}
                      >
                        {attendanceRate}%
                      </p>
                    </div>
                    <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          attendanceRate >= 80
                            ? "bg-emerald-400"
                            : "bg-rose-400"
                        }`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100 px-2.5 py-1 rounded-full">
                    {attendanceCount.present_count} Present
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 ring-1 ring-rose-100 px-2.5 py-1 rounded-full">
                    {attendanceCount.absent_count} Absent
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 items-start divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-700/50">
              {/* Present */}
              <div className="p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Present Staff
                </p>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 rounded-lg animate-shimmer" />
                    ))}
                  </div>
                ) : attendanceCount?.present.length === 0 ? (
                  <p className="text-xs text-slate-300 italic">
                    No staff present yet
                  </p>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {attendanceCount?.present.map((s, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1.5 bg-emerald-50/60 dark:bg-emerald-900/20 ring-1 ring-emerald-100 dark:ring-emerald-800/30 rounded-xl px-2 py-3 text-center"
                      >
                        <Avatar name={s.name} size="sm" />
                        <div className="min-w-0 w-full">
                          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                            {s.name}
                          </p>
                          {s.role && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {s.role}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Absent */}
              <div className="p-5">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Absent Staff
                </p>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 rounded-lg animate-shimmer" />
                    ))}
                  </div>
                ) : attendanceCount?.absent.length === 0 ? (
                  <p className="text-xs text-slate-300 italic">
                    All staff present!
                  </p>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {attendanceCount?.absent.map((s, i) => (
                      <div
                        key={i}
                        className="relative flex flex-col items-center gap-1.5 bg-rose-50/60 dark:bg-rose-900/20 ring-1 ring-rose-100 dark:ring-rose-800/30 rounded-xl px-2 py-3 text-center"
                      >
                        <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 ring-1 ring-rose-200 dark:ring-rose-700/50 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-rose-500">
                            {s.name
                              .trim()
                              .split(" ")
                              .map((p: string) => p[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate leading-tight">
                            {s.name}
                          </p>
                          {s.role && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {s.role}
                            </p>
                          )}
                        </div>
                        {(s.consecutive_absences ?? 0) >= 2 && (
                          <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full">
                            {s.consecutive_absences}d streak
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Live Attendance ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Live Attendance
            </h2>
            {!loading && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* ── Search & Filter ── */}
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {(["all", "clocked_in", "complete"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`h-9 px-3 rounded-lg text-[11px] font-semibold transition-all ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {s === "all"
                    ? "All"
                    : s === "clocked_in"
                      ? "Working"
                      : "Done"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-100 p-5 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full animate-shimmer" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-1/2 rounded animate-shimmer" />
                        <div className="h-2.5 w-1/3 rounded animate-shimmer" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div
                          key={j}
                          className="h-10 rounded-xl animate-shimmer"
                        />
                      ))}
                    </div>
                    <div className="h-4 rounded animate-shimmer" />
                  </div>
                ))}
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  {searchQuery || statusFilter !== "all"
                    ? "No staff match your search."
                    : "No attendance records for today."}
                </p>
                {(searchQuery || statusFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAttendance.map((r, i) => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.complete;
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border border-slate-200/60 dark:border-slate-700/60 border-l-4 ${cfg.border} p-5 hover:shadow-card-hover hover:scale-[1.01] transition-all duration-200 bg-white dark:bg-slate-800 animate-fade-in`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={r.name} />
                            {r.status === "clocked_in" && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                            )}
                            {r.status === "on_break" && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                              {r.name}
                            </p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {r.late && (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200 px-1.5 py-0.5 rounded-full">
                                  Late
                                </span>
                              )}
                              {r.undertime && r.status === "complete" && (
                                <span className="text-[10px] font-bold bg-orange-50 text-orange-600 ring-1 ring-orange-200 px-1.5 py-0.5 rounded-full">
                                  Undertime
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
                            Time In
                          </p>
                          <p className="text-sm font-bold tabular-nums text-emerald-600">
                            {r.time_in ?? "—"}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
                            Time Out
                          </p>
                          <p className="text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
                            {r.time_out ?? "—"}
                          </p>
                        </div>

                        {/* Break — full width with start/end times */}
                        <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">
                              Break
                            </p>
                            <p className="text-sm font-bold tabular-nums text-amber-600">
                              {fmtHours(r.break_duration)}
                            </p>
                          </div>
                          {r.break_start || r.break_end ? (
                            <div className="flex items-center gap-1.5 text-[10px] tabular-nums text-amber-500">
                              <span className="font-semibold">
                                {r.break_start ?? "—"}
                              </span>
                              <span className="text-amber-300">→</span>
                              <span className="font-semibold">
                                {r.break_end ?? "ongoing"}
                              </span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-300">
                              No break recorded
                            </p>
                          )}
                        </div>

                        {/* Total Hours — full width */}
                        <div className="col-span-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">
                              Total Hours
                            </p>
                            <p className="text-sm font-bold tabular-nums text-indigo-600">
                              {fmtHours(r.hours_worked)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Hours Progress Bar */}
                      <HoursProgress hours={r.hours_worked} status={r.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Tasks card ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Staff Task Log
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Activity recorded today
              </p>
            </div>
            {!loading && (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 px-2.5 py-1 rounded-full">
                {todayTasks.length}{" "}
                {todayTasks.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <SkeletonTaskCard key={i} />
              ))
            ) : todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3">
                  <CheckSquare className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  No tasks recorded yet today
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  Check back later
                </p>
              </div>
            ) : (
              // Group tasks by person
              Object.entries(
                todayTasks.reduce<Record<string, Task[]>>((acc, task) => {
                  acc[task.name] = acc[task.name] || [];
                  acc[task.name].push(task);
                  return acc;
                }, {}),
              ).map(([name, tasks], i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors group animate-fade-in"
                >
                  <div className="flex items-start gap-4 mb-3">
                    <Avatar name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">
                        {name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tasks.map((task, taskIdx) => (
                      <div key={taskIdx} className="flex items-start gap-2">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                          {new Date(task.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
                          {task.task}
                        </p>
                        {task.url && (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Summaries ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Attendance Summaries
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Aggregated attendance data
              </p>
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              <button
                onClick={() => setSummaryTab("weekly")}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  summaryTab === "weekly"
                    ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setSummaryTab("monthly")}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  summaryTab === "monthly"
                    ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {summaryTab === "weekly" ? (
            <div className="p-6">
              {loading ? (
                <div className="h-64 rounded-xl animate-shimmer" />
              ) : weeklySummaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    No weekly summary data available.
                  </p>
                </div>
              ) : (
                <>
                  {/* Weekly stat pills */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    {weeklySummaries.slice(-1).map((w, i) => (
                      <Fragment key={i}>
                        <div className="flex items-center gap-1.5 bg-blue-50 ring-1 ring-blue-100 px-3 py-1.5 rounded-full">
                          <Users className="w-3 h-3 text-blue-500" />
                          <span className="text-[11px] font-bold text-blue-600">
                            {w.unique_staff} staff this week
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 ring-1 ring-slate-200 px-3 py-1.5 rounded-full">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">
                            {w.days_worked} days worked
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-indigo-50 ring-1 ring-indigo-100 px-3 py-1.5 rounded-full">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span className="text-[11px] font-bold text-indigo-600">
                            {fmtHours(w.total_hours)} total
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>

                  {/* Pie charts — 2 column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Total Hours by Week */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">
                        Total Hours by Week
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={weeklySummaries}
                            dataKey="total_hours"
                            nameKey="week"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={36}
                            paddingAngle={3}
                            label={({ percent = 0 }) =>
                              percent > 0.05
                                ? `${(percent * 100).toFixed(0)}%`
                                : ""
                            }
                            labelLine={false}
                          >
                            {weeklySummaries.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: number | undefined) => [
                              fmtHours(value),
                              "Total Hours",
                            ]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Days Worked by Week */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">
                        Days Worked by Week
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={weeklySummaries}
                            dataKey="days_worked"
                            nameKey="week"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={36}
                            paddingAngle={3}
                            label={({ percent = 0 }) =>
                              percent > 0.05
                                ? `${(percent * 100).toFixed(0)}%`
                                : ""
                            }
                            labelLine={false}
                          >
                            {weeklySummaries.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: number | undefined) => [
                              value ?? 0,
                              "Days Worked",
                            ]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-6">
              {loading ? (
                <div className="h-64 rounded-xl animate-shimmer" />
              ) : monthlySummaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    No monthly summary data available.
                  </p>
                </div>
              ) : (
                <>
                  {/* Monthly stat pills */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    {monthlySummaries.slice(-1).map((m, i) => (
                      <Fragment key={i}>
                        <div className="flex items-center gap-1.5 bg-blue-50 ring-1 ring-blue-100 px-3 py-1.5 rounded-full">
                          <Users className="w-3 h-3 text-blue-500" />
                          <span className="text-[11px] font-bold text-blue-600">
                            {m.unique_staff} staff this month
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 ring-1 ring-slate-200 px-3 py-1.5 rounded-full">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">
                            {m.days_worked} days worked
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-indigo-50 ring-1 ring-indigo-100 px-3 py-1.5 rounded-full">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span className="text-[11px] font-bold text-indigo-600">
                            {fmtHours(m.total_hours)} total
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-50 ring-1 ring-amber-100 px-3 py-1.5 rounded-full">
                          <Coffee className="w-3 h-3 text-amber-500" />
                          <span className="text-[11px] font-bold text-amber-600">
                            {fmtHours(m.total_break_hours)} break
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>

                  {/* Pie charts — 2 column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Total Hours by Month */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">
                        Total Hours by Month
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={monthlySummaries}
                            dataKey="total_hours"
                            nameKey="month_name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={36}
                            paddingAngle={3}
                            label={({ percent = 0 }) =>
                              percent > 0.05
                                ? `${(percent * 100).toFixed(0)}%`
                                : ""
                            }
                            labelLine={false}
                          >
                            {monthlySummaries.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: number | undefined) => [
                              fmtHours(value),
                              "Total Hours",
                            ]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Worked vs Break Hours (aggregate) */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">
                        Worked vs Break Hours
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Worked",
                                value: monthlySummaries.reduce(
                                  (s, m) =>
                                    s +
                                    (m.total_hours -
                                      (m.total_break_hours ?? 0)),
                                  0,
                                ),
                              },
                              {
                                name: "Break",
                                value: monthlySummaries.reduce(
                                  (s, m) => s + (m.total_break_hours ?? 0),
                                  0,
                                ),
                              },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={36}
                            paddingAngle={3}
                            label={({ percent = 0 }) =>
                              percent > 0.05
                                ? `${(percent * 100).toFixed(0)}%`
                                : ""
                            }
                            labelLine={false}
                          >
                            <Cell fill="#6366f1" />
                            <Cell fill="#fbbf24" />
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: number | undefined) => [
                              fmtHours(value),
                            ]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 dark:text-slate-600 pb-2 select-none">
          Digital Benefits · Attendance Dashboard
        </p>
      </main>

      {/* ── Export Modal ── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-modal border border-slate-200/80 dark:border-slate-700 flex flex-col max-h-[88vh] animate-slide-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl ring-1 ring-emerald-100 dark:ring-emerald-800/40">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">
                    Export Report
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formattedDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/30">
              {/* Absent preview */}
              {(attendanceCount?.absent.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Absent Staff Preview
                  </p>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-rose-50 dark:bg-rose-900/20 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5">Name</th>
                          <th className="px-3 py-2.5">Role</th>
                          <th className="px-3 py-2.5">Streak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {attendanceCount?.absent.map((s, i) => (
                          <tr key={i} className="dark:bg-slate-800">
                            <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                              {s.name}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                              {s.role || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {(s.consecutive_absences ?? 0) >= 2 ? (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                                  {s.consecutive_absences}d
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance preview */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  Attendance Preview
                </p>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-3 py-2.5">In</th>
                        <th className="px-3 py-2.5">Out</th>
                        <th className="px-3 py-2.5">Break Time</th>
                        <th className="px-3 py-2.5">Break Dur.</th>
                        <th className="px-3 py-2.5">Total Hours</th>
                        <th className="px-3 py-2.5">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {todayAttendance.slice(0, 6).map((r, i) => (
                        <tr key={i} className="dark:bg-slate-800">
                          <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                            {r.name}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.time_in || "—"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.time_out || "—"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-amber-600 whitespace-nowrap">
                            {r.break_start || r.break_end
                              ? `${r.break_start ?? "—"} → ${r.break_end ?? "ongoing"}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-amber-600 font-semibold">
                            {fmtHours(r.break_duration)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums font-semibold text-indigo-600">
                            {fmtHours(r.hours_worked)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {r.late && (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">
                                  Late
                                </span>
                              )}
                              {r.undertime && (
                                <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                                  UT
                                </span>
                              )}
                              {!r.late && !r.undertime && (
                                <span className="text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Task Log preview */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  Task Log Preview
                </p>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Staff</th>
                        <th className="px-3 py-2.5">Task</th>
                        <th className="px-3 py-2.5">Time</th>
                        <th className="px-3 py-2.5">Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {todayTasks.slice(0, 5).map((t, i) => (
                        <tr key={i} className="dark:bg-slate-800">
                          <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {t.name}
                          </td>
                          <td className="px-3 py-2.5 max-w-[180px] truncate text-slate-600 dark:text-slate-300">
                            {t.task}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-500 whitespace-nowrap">
                            {new Date(t.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2.5">
                            {t.url ? (
                              <span className="text-indigo-600 font-semibold">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="h-10 px-4 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  downloadXLSX();
                  setShowPreview(false);
                }}
                className="h-10 px-5 bg-indigo-600 text-white text-sm font-semibold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
              >
                <Download className="w-4 h-4" /> Download .xlsx
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error toast ── */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xl border border-white/10 animate-slide-up">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

export default App;
