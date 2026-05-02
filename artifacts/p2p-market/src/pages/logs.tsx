import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuthHeaders } from "@/lib/store";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Shield, ArrowLeft, Trash2, MapPin, RefreshCw, Laptop, Smartphone, Monitor,
} from "lucide-react";

type SecurityLog = {
  id: number;
  path: string;
  method: string;
  statusCode: number;
  logType: string | null;
  userId: number | null;
  username: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  userAgent: string | null;
  referer: string | null;
  createdAt: string;
};

const LOG_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  scanner:  { label: "Scanner",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  honeypot: { label: "Honeypot", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  not_found: { label: "404",     color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export default function Logs() {
  const requestOptions = useAuthHeaders();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ logs: SecurityLog[]; total: number }>({
    queryKey: ["admin-security-logs"],
    queryFn: () => customFetch("/admin/security-logs", { headers: requestOptions.headers }),
    refetchInterval: 30000,
  });

  const clearMutation = useMutation({
    mutationFn: () => customFetch("/admin/security-logs", {
      method: "DELETE",
      headers: requestOptions.headers,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-security-logs"] });
      toast({ title: "Logs dihapus", description: "Semua security logs telah dihapus." });
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary flex items-center gap-3">
            <Shield size={28} className="text-slate-500" />
            Security Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Log akses ke halaman yang tidak ada dan percobaan scanner bot — 20 entri terbaru.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => { if (confirm("Hapus semua security logs?")) clearMutation.mutate(); }}
            disabled={clearMutation.isPending || logs.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} />
            Hapus Semua
          </button>
        </div>
      </div>

      {/* Summary badge */}
      {!isLoading && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Menampilkan {logs.length} dari {data?.total ?? 0} total entri
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="p-20 text-center text-slate-400 dark:text-slate-500">Memuat logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-card rounded-3xl border border-slate-200 dark:border-slate-700">
          <Shield size={64} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
          <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500">Belum ada log</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Log akan muncul saat ada akses ke halaman yang tidak ada atau percobaan scan bot.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                  {["Waktu", "Tipe", "Path", "User", "IP", "Lokasi", "Device", "Referer"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {logs.map(log => {
                  const typeInfo = LOG_TYPE_LABEL[log.logType ?? "not_found"] ?? LOG_TYPE_LABEL["not_found"];
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Waktu */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd MMM, HH:mm:ss", { locale: id })}
                      </td>
                      {/* Tipe */}
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      {/* Path */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{log.method}</span>
                          <span className="text-red-600 dark:text-red-400 font-medium text-xs max-w-[180px] truncate" title={log.path}>{log.path}</span>
                        </div>
                      </td>
                      {/* User */}
                      <td className="px-4 py-3">
                        {log.username ? (
                          <div>
                            <p className="text-xs font-bold text-secondary">{log.username}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">#{log.userId}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Tamu</span>
                        )}
                      </td>
                      {/* IP */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{log.ip || "-"}</span>
                      </td>
                      {/* Lokasi */}
                      <td className="px-4 py-3">
                        {(log.city || log.country) ? (
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <MapPin size={10} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                            <span>{[log.city, log.country].filter(Boolean).join(", ")}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400 dark:text-slate-600">-</span>}
                      </td>
                      {/* Device */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          {log.device === "Mobile"
                            ? <Smartphone size={12} className="text-slate-400 dark:text-slate-500" />
                            : log.device === "Tablet"
                            ? <Monitor size={12} className="text-slate-400 dark:text-slate-500" />
                            : <Laptop size={12} className="text-slate-400 dark:text-slate-500" />}
                          {log.device || "-"}
                        </div>
                      </td>
                      {/* Referer */}
                      <td className="px-4 py-3">
                        {log.referer
                          ? <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[130px] truncate block" title={log.referer}>{log.referer}</span>
                          : <span className="text-xs text-slate-400 dark:text-slate-600">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
