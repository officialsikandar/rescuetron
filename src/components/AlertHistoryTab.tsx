import React, { useState, useEffect } from 'react';
import { History, ExternalLink, PhoneCall, CheckCircle2, AlertTriangle, Clock, MapPin, Activity, ShieldCheck, Mail, RefreshCw, Eye, AlertCircle, Trash2 } from 'lucide-react';
import { getAlertHistory, triggerAutoCallEscalation, simulateEmailOpen, deleteAlertRecord, clearAlertHistory } from '../services/api';
import { AlertRecord, AuthState } from '../types';

interface AlertHistoryTabProps {
  authState: AuthState;
  onOpenTrackerModal: (trackerId: string) => void;
}

export const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({ authState, onOpenTrackerModal }) => {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [callModal, setCallModal] = useState<{ active: boolean; phone: string; name: string } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await getAlertHistory(authState.user?.id || 'demo');
      if (res.success && res.alerts) {
        setAlerts(res.alerts);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, [authState.user?.id]);

  const handleDeleteSingle = async (alertId: string) => {
    try {
      await deleteAlertRecord(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete all emergency incident logs?')) {
      try {
        await clearAlertHistory(authState.user?.id || 'demo');
        setAlerts([]);
      } catch (e) {
        setAlerts([]);
      }
    }
  };

  // Simulate Auto Call Escalation
  const handleSimulateAutoCall = async (alert: AlertRecord) => {
    try {
      const res = await triggerAutoCallEscalation(alert.id);
      if (res.success) {
        setCallModal({
          active: true,
          phone: alert.contactNotifiedPhone || '+91 98111 22233',
          name: alert.userName || 'Rahul Sharma',
        });
        fetchHistory();
      }
    } catch (err) {
      console.error('Error escalating call:', err);
    }
  };

  // Simulate Contact Opening Email
  const handleSimulateOpen = async (alertId: string) => {
    try {
      await simulateEmailOpen(alertId);
      fetchHistory();
    } catch (e) {
      console.error('Error simulating email open:', e);
    }
  };

  return (
    <div className="flex-1 p-3.5 space-y-3.5 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-rose-500" />
            <span>Emergency Incident Log</span>
          </h2>
          <p className="text-[10px] text-slate-400">Live email open tracking & GPS dispatch status</p>
        </div>

        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[10px] hover:bg-rose-900 transition flex items-center gap-1 font-bold"
              title="Clear all incident history"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Clear All</span>
            </button>
          )}
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[10px] hover:bg-slate-800 transition flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Cards List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-300">No Emergency Alerts Recorded</p>
            <p className="text-[11px]">Your accident protection system is active and monitoring.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-2.5 relative overflow-hidden"
            >
              {/* Top Row: Time & Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(alert.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>

                {/* Status Badge & Delete Button */}
                <div className="flex items-center gap-1.5">
                  {alert.emailOpened || alert.status === 'TRACKER_OPENED' || alert.status === 'EMAIL_OPENED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Email Opened</span>
                    </span>
                  ) : alert.status === 'ESCALATED_CALL' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-400 text-[10px] font-semibold animate-pulse">
                      <PhoneCall className="w-3 h-3" />
                      <span>Escalated to Call</span>
                    </span>
                  ) : alert.status === 'CANCELLED_BY_USER' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-semibold">
                      <span>Cancelled</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-semibold animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Email Not Opened Yet</span>
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteSingle(alert.id)}
                    className="p-1 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-400 hover:bg-rose-900 transition"
                    title="Delete this incident log"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Accident Summary Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    <span>Location</span>
                  </span>
                  <span className="text-slate-200 font-medium truncate block text-[11px]">
                    {alert.location?.address || 'New Delhi, India'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-amber-400" />
                    <span>Sensor Impact</span>
                  </span>
                  <span className="text-amber-400 font-mono font-bold text-[11px]">
                    {alert.sensorSnapshot?.totalG?.toFixed(1) || 6.2}G Force Surge
                  </span>
                </div>
              </div>

              {/* Email Open Tracking Card */}
              <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                alert.emailOpened
                  ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-900/60 text-amber-200'
              }`}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Recipient: {alert.contactNotifiedEmail}</span>
                  </span>

                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    alert.emailOpened
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {alert.emailOpened ? 'Opened' : 'Unopened'}
                  </span>
                </div>

                <div className="text-[10px] leading-relaxed">
                  {alert.emailOpened ? (
                    <p className="text-emerald-300/90">
                      👁️ Email opened at <strong className="text-white">{new Date(alert.emailOpenedAt || '').toLocaleTimeString()}</strong> ({alert.emailOpenCount || 1} open recorded).
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-amber-300/90">
                        ⏳ Email sent • Recipient has not opened the message yet.
                      </p>
                      <button
                        onClick={() => handleSimulateOpen(alert.id)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 border border-amber-500/40 font-bold text-[9px] transition"
                        title="Simulate recipient viewing the email in mail client"
                      >
                        Simulate Open
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Actions */}
              <div className="flex items-center gap-2 pt-1">
                {/* 1. Open Contact Tracker Modal */}
                <button
                  onClick={() => onOpenTrackerModal(alert.trackerId)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-300 border border-slate-700 text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                  <span>View Live Tracker</span>
                </button>

                {/* 2. Trigger Auto Call */}
                {alert.status !== 'CANCELLED_BY_USER' && (
                  <button
                    onClick={() => handleSimulateAutoCall(alert)}
                    className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-950"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Auto-Call</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Auto-Call Simulated Modal */}
      {callModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 max-w-xs w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500 flex items-center justify-center mx-auto text-rose-400 animate-pulse">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Emergency Voice Call Active</h3>
            <p className="text-xs text-slate-300">
              Automated SOS dispatch call connected to: <strong className="text-rose-400">{callModal.phone}</strong>
            </p>
            <button
              onClick={() => setCallModal(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
            >
              Close Simulator
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
