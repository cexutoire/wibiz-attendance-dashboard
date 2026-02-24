import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, AlertCircle, FileSpreadsheet, X, Download, Coffee, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchTodayAttendance, fetchStats, fetchTodayTasks } from './api';
import type { AttendanceRecord, Task, Stats } from './types';

function App() {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const loadData = async () => {
    try {
      setLoading(true);
      const [attendance, statistics, tasks] = await Promise.all([
        fetchTodayAttendance(),
        fetchStats(),
        fetchTodayTasks(),
      ]);
      setTodayAttendance(attendance);
      setStats(statistics);
      setTodayTasks(tasks);
      setCurrentDate(new Date()); // Keeps the date current
      setError(null);
    } catch (err) {
      setError('API Offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = currentDate.toLocaleDateString('en-PH', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const downloadXLSX = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Attendance
    const attHeader = ["Member", "In", "Out", "Break", "Hours", "Status"];
    const attRows = todayAttendance.map(r => [
      r.name, 
      r.time_in || '-', 
      r.time_out || '-', 
      r.break_duration ? `${r.break_duration.toFixed(1)}h` : '-',
      r.hours_worked?.toFixed(2) || '0', 
      r.status.toUpperCase()
    ]);
    const attSheet = XLSX.utils.aoa_to_sheet([attHeader, ...attRows]);
    XLSX.utils.book_append_sheet(workbook, attSheet, "Attendance");

    // Sheet 2: Task Report
    const taskHeader = ["Staff", "Task Detail", "Time", "Link"];
    const taskRows = todayTasks.map(t => [
      t.name, 
      t.task, 
      new Date(t.created_at).toLocaleTimeString(), 
      t.url || '-'
    ]);
    const taskSheet = XLSX.utils.aoa_to_sheet([taskHeader, ...taskRows]);
    XLSX.utils.book_append_sheet(workbook, taskSheet, "Task Report");

    XLSX.writeFile(workbook, `Digital_Benefits_Report_${currentDate.toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-slate-100 text-slate-400';
      case 'on_break': return 'bg-amber-50 text-amber-600';
      case 'clocked_in': return 'bg-emerald-50 text-emerald-600';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 relative">
      <header className="max-w-5xl mx-auto px-6 pt-12 pb-8 flex justify-between items-end border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Digital Benefits</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-sm font-medium text-slate-500">{formattedDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setShowPreview(true)} className="text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="w-4 h-4" /> Export
          </button>
          <button onClick={loadData} className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2 text-sm font-medium">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-8 mb-12">
          <QuickStat label="Working Now" value={stats?.currently_working} color="text-emerald-600" />
          <QuickStat label="On Break" value={stats?.on_break} color="text-amber-600" icon={<Coffee className="w-4 h-4" />} />
          <QuickStat label="Weekly Total" value={`${stats?.week_hours}h`} />
          <QuickStat label="Today's Tasks" value={todayTasks.length} />
        </div>

        {/* Live Attendance Table */}
        <section className="mb-20">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Attendance</h3>
          <div className="overflow-hidden border border-slate-100 rounded-lg shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100 text-left">
                  <th className="py-3 px-4 font-medium w-1/4">Member</th>
                  <th className="py-3 px-4 font-medium">Schedule</th>
                  <th className="py-3 px-4 font-medium">Break</th>
                  <th className="py-3 px-4 font-medium">Duration</th>
                  <th className="py-3 px-4 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayAttendance.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-4 font-medium text-slate-700">{r.name}</td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums">
                      {r.time_in || '--:--'} <span className="text-slate-200 px-1">/</span> {r.time_out || '--:--'}
                    </td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums">
                      {r.break_duration ? <span className="text-amber-600 font-medium">{r.break_duration.toFixed(1)}h</span> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums">{r.hours_worked ? `${r.hours_worked.toFixed(1)}h` : '-'}</td>
                    <td className="py-4 px-4 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(r.status)}`}>
                        {r.status === 'clocked_in' ? 'Working' : r.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Task Details Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Staff Task Details</h3>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">ACTIVITY LOG</span>
          </div>
          <div className="grid gap-3">
            {todayTasks.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No tasks recorded yet today.</p>
            ) : (
              todayTasks.map((task, i) => (
                <div key={i} className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all">
                  <div className="shrink-0 w-1 bg-slate-200 group-hover:bg-blue-400 self-stretch rounded-full transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-800">{task.name}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed truncate">{task.task}</p>
                  </div>
                  {task.url && (
                    <a href={task.url} target="_blank" className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* XLSX Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg leading-tight">Export Report</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formattedDate}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-8 bg-slate-50/30">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Attendance Preview</p>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-tighter">
                      <tr><th className="p-2">Name</th><th className="p-2">In</th><th className="p-2">Out</th><th className="p-2">Break</th></tr>
                    </thead>
                    <tbody>
                      {todayAttendance.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-medium text-slate-700">{r.name}</td>
                          <td className="p-2">{r.time_in || '-'}</td>
                          <td className="p-2">{r.time_out || '-'}</td>
                          <td className="p-2">{r.break_duration ? `${r.break_duration.toFixed(1)}h` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Recent Tasks Preview</p>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                   <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-tighter">
                      <tr><th className="p-2">Staff</th><th className="p-2">Task Detail</th><th className="p-2">Link</th></tr>
                    </thead>
                    <tbody>
                      {todayTasks.slice(0, 5).map((t, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-medium text-slate-700">{t.name}</td>
                          <td className="p-2 truncate max-w-[200px]">{t.task}</td>
                          <td className="p-2 text-blue-500">{t.url ? 'Yes' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={() => { downloadXLSX(); setShowPreview(false); }} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-black shadow-lg shadow-slate-200 transition-all active:scale-95">
                <Download className="w-4 h-4" /> Download .xlsx
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xl border border-white/10">
          <AlertCircle className="w-4 h-4 text-red-400" /> {error}
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value, color = "text-slate-800", icon }: { label: string, value: any, color?: string, icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-medium tabular-nums ${color} flex items-center gap-1`}>
        {icon}
        {value ?? 0}
      </p>
    </div>
  );
}

export default App;