import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowLeft, BarChart3, Clock, Zap, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LogEntry {
  id: string;
  query: string;
  intent: string | null;
  chunks_retrieved: number;
  response_length: number;
  latency_ms: number | null;
  relevance_score: number | null;
  error: string | null;
  created_at: string;
}

const Analytics = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, avgLatency: 0, errors: 0, avgRelevance: 0 });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadLogs();
  }, [user]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("query_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      const typed = data as any as LogEntry[];
      setLogs(typed);
      const total = typed.length;
      const avgLatency = total > 0
        ? typed.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / total
        : 0;
      const errors = typed.filter((l) => l.error).length;
      const relevanceEntries = typed.filter((l) => l.relevance_score != null);
      const avgRelevance = relevanceEntries.length > 0
        ? relevanceEntries.reduce((sum, l) => sum + (l.relevance_score || 0), 0) / relevanceEntries.length
        : 0;
      setStats({ total, avgLatency, errors, avgRelevance });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-base font-bold text-foreground">Analytics</span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Queries', value: stats.total, icon: Search, color: 'text-primary' },
            { label: 'Avg Latency', value: `${(stats.avgLatency / 1000).toFixed(1)}s`, icon: Clock, color: 'text-primary' },
            { label: 'Errors', value: stats.errors, icon: AlertCircle, color: 'text-destructive' },
            { label: 'Avg Relevance', value: `${Math.round(stats.avgRelevance * 100)}%`, icon: Zap, color: 'text-primary' },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Query log table */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Queries</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Query</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Intent</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Chunks</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Latency</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Relevance</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-3 max-w-[200px] truncate text-foreground">{log.query}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{log.intent || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.chunks_retrieved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.latency_ms ? `${(log.latency_ms / 1000).toFixed(1)}s` : '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.relevance_score ? `${Math.round(log.relevance_score * 100)}%` : '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No queries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
