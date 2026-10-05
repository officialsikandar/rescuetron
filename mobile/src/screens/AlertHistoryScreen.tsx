import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { EmergencyAlert, EmergencyContact } from '../types';
import {
  getAlertHistory,
  getAlertStatus,
  simulateEmailOpen,
  triggerAutoCallEscalation,
  deleteAlertRecord,
  clearAlertHistory,
  getAppSettings,
  fetchEmergencyContacts,
} from '../services/api';
import { subscribeWs } from '../services/websocket';
import { Toast } from '../components/Toast';

// Persistent module-level timer tracking so countdown starts at full default wait time
// as soon as the emergency mail is sent and the History screen opens
const localAlertStartMsMap: Record<string, number> = {};
const autoDialedAlertIds = new Set<string>();

export const registerNewDispatchedAlertTimer = (alertId: string, startMs: number = Date.now()) => {
  if (!alertId) return;
  localAlertStartMsMap[alertId] = startMs;
  autoDialedAlertIds.delete(alertId);
};

interface AlertHistoryScreenProps {
  userId: string;
  latestDispatchedAlert?: EmergencyAlert | null;
}

export const AlertHistoryScreen: React.FC<AlertHistoryScreenProps> = ({
  userId,
  latestDispatchedAlert,
}) => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>(() =>
    latestDispatchedAlert ? [latestDispatchedAlert] : []
  );
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [defaultWaitSeconds, setDefaultWaitSeconds] = useState<number>(20);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [loading, setLoading] = useState(!latestDispatchedAlert);
  const [refreshing, setRefreshing] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Resolve all emergency contact phone numbers (primary first)
  const getContactPhoneList = (alertItem?: any): string[] => {
    const sortedContacts = [...contacts].sort(
      (a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)
    );
    const candidates: string[] = [
      ...(Array.isArray(alertItem?.contactPhones) ? alertItem.contactPhones : []),
      alertItem?.contactNotifiedPhone,
      ...sortedContacts.map((c) => c.phone),
    ]
      .map((p) => (p ? String(p).trim() : ''))
      .filter(Boolean);

    return Array.from(new Set(candidates));
  };

  // Dial emergency contact phone number on the device
  const dialContactPhone = (phoneRaw?: string, alertItem?: any) => {
    const allPhones = getContactPhoneList(alertItem);
    const targetPhone = phoneRaw || allPhones[0] || '';
    const cleanPhone = targetPhone.replace(/[^0-9+]/g, '');
    if (!cleanPhone) {
      showToast('No emergency contact phone number configured in Contacts', 'error');
      return;
    }
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      showToast(`Dialing ${cleanPhone}...`, 'info');
    });
  };

  // Ensure newly dispatched alert is immediately visible and starts countdown timer
  useEffect(() => {
    if (latestDispatchedAlert?.id) {
      if (!localAlertStartMsMap[latestDispatchedAlert.id]) {
        localAlertStartMsMap[latestDispatchedAlert.id] = Date.now();
      }
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === latestDispatchedAlert.id);
        return exists ? prev : [latestDispatchedAlert, ...prev];
      });
    }
  }, [latestDispatchedAlert]);

  // Load settings & contacts on mount
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, fetchedContacts] = await Promise.all([
          getAppSettings(),
          fetchEmergencyContacts(userId),
        ]);
        if (settingsRes?.settings?.trackerWaitSeconds) {
          setDefaultWaitSeconds(Number(settingsRes.settings.trackerWaitSeconds) || 20);
        }
        if (Array.isArray(fetchedContacts) && fetchedContacts.length > 0) {
          setContacts(fetchedContacts);
        }
      } catch (_e) {
        // ignore
      }
    })();
  }, [userId]);

  // 1-second ticker for live countdown timer on unopened alerts
  useEffect(() => {
    const tick = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Poll history & subscribe to WebSocket events
  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 2000);
    const unsubscribeWs = subscribeWs((event) => {
      if (
        event.type === 'EMAIL_OPENED' ||
        event.type === 'ALERT_TRIGGERED' ||
        event.type === 'CALL_ESCALATED' ||
        event.type === 'ALERT_DELETED' ||
        event.type === 'ALERT_HISTORY_CLEARED'
      ) {
        if (event.type === 'EMAIL_OPENED' && event.alert) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === event.alert.id ? { ...a, ...event.alert, emailOpened: true } : a))
          );
          showToast('✉️ Emergency contact opened the email! Timer stopped.', 'success');
        } else {
          loadHistory();
        }
      }
      if (event.type === 'SETTINGS_UPDATED' && event.settings?.trackerWaitSeconds) {
        setDefaultWaitSeconds(Number(event.settings.trackerWaitSeconds) || 20);
      }
    });
    return () => {
      clearInterval(interval);
      unsubscribeWs();
    };
  }, [userId]);

  const loadHistory = async () => {
    try {
      const [fetched, fetchedContacts] = await Promise.all([
        getAlertHistory(userId),
        contacts.length === 0 ? fetchEmergencyContacts(userId) : Promise.resolve(contacts),
      ]);
      if (Array.isArray(fetchedContacts) && fetchedContacts.length > 0 && contacts.length === 0) {
        setContacts(fetchedContacts);
      }

      if (Array.isArray(fetched)) {
        // Register local start timestamp for any newly arrived unopened alert so countdown runs full duration
        fetched.forEach((a: any) => {
          const isOpened =
            Boolean(a.emailOpened) ||
            a.status === 'EMAIL_OPENED' ||
            a.status === 'TRACKER_OPENED';
          const isCancelled = a.status === 'CANCELLED_BY_USER' || a.status === 'CANCELLED';
          const isEscalated = a.status === 'ESCALATED_CALL';

          if (!isOpened && !isCancelled && !isEscalated && !localAlertStartMsMap[a.id]) {
            const serverCreatedMs = new Date(a.timestamp || a.createdAt || Date.now()).getTime();
            const serverAgeSecs = !isNaN(serverCreatedMs)
              ? Math.floor((Date.now() - serverCreatedMs) / 1000)
              : 0;
            // If alert was just created (within last 180s), start local countdown from now
            if (serverAgeSecs <= 180) {
              localAlertStartMsMap[a.id] = Date.now();
            } else {
              localAlertStartMsMap[a.id] = serverCreatedMs;
            }
          }
        });
        setAlerts(fetched);
      }
    } catch (_e) {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to compute elapsed & remaining seconds for an alert
  const getAlertTimerState = (alertItem: any) => {
    const waitLimitSecs =
      Number(alertItem?.escalationTimerSeconds) || Number(defaultWaitSeconds) || 20;
    const isOpened =
      Boolean(alertItem?.emailOpened) ||
      alertItem?.status === 'EMAIL_OPENED' ||
      alertItem?.status === 'TRACKER_OPENED';
    const isCancelled =
      alertItem?.status === 'CANCELLED_BY_USER' || alertItem?.status === 'CANCELLED';
    const isEscalated = alertItem?.status === 'ESCALATED_CALL';

    const startMs =
      localAlertStartMsMap[alertItem?.id] ??
      new Date(alertItem?.timestamp || alertItem?.createdAt || Date.now()).getTime();
    const elapsedSecs = !isNaN(startMs) ? Math.max(0, Math.floor((nowMs - startMs) / 1000)) : 0;
    const remainingSecs = isOpened || isCancelled ? 0 : Math.max(0, waitLimitSecs - elapsedSecs);

    return {
      waitLimitSecs,
      elapsedSecs,
      remainingSecs,
      isOpened,
      isCancelled,
      isEscalated,
      startMs,
    };
  };

  // Fast status polling & Auto-dial when countdown expires for the latest active unopened alert
  useEffect(() => {
    if (!alerts || alerts.length === 0) return;

    const latestAlert: any = alerts[0];
    if (!latestAlert) return;

    const {
      waitLimitSecs,
      elapsedSecs,
      isOpened,
      isCancelled,
      isEscalated,
    } = getAlertTimerState(latestAlert);

    if (isOpened || isCancelled) return;

    // Poll single alert status for instant email-open detection while countdown is active
    if (elapsedSecs < waitLimitSecs) {
      getAlertStatus(latestAlert.id)
        .then((res) => {
          if (res?.success && res?.alert?.emailOpened) {
            setAlerts((prev) =>
              prev.map((a) => (a.id === latestAlert.id ? { ...a, ...res.alert, emailOpened: true } : a))
            );
            showToast('✉️ Emergency contact opened the email! Auto-call cancelled.', 'success');
          }
        })
        .catch(() => {});
      return;
    }

    // Countdown reached 0 and nobody opened the email -> Auto-dial emergency contact phone number!
    if (
      elapsedSecs >= waitLimitSecs &&
      elapsedSecs < waitLimitSecs + 180 &&
      !autoDialedAlertIds.has(latestAlert.id)
    ) {
      autoDialedAlertIds.add(latestAlert.id);
      const phoneList = getContactPhoneList(latestAlert);
      const primaryPhone = phoneList[0] || '';

      showToast(
        `⏰ Email not opened in ${waitLimitSecs}s! Auto-dialing ${primaryPhone || 'Emergency Contact'}...`,
        'error'
      );

      if (!isEscalated) {
        triggerAutoCallEscalation(latestAlert.id)
          .then(() => loadHistory())
          .catch(() => {});
      }

      dialContactPhone(primaryPhone, latestAlert);
    }
  }, [nowMs, alerts, defaultWaitSeconds, contacts]);

  const handleSimulateOpen = async (alertId: string) => {
    try {
      const res = await simulateEmailOpen(alertId);
      if (res.success) {
        showToast('✉️ Email opened by emergency contact! Auto-call cancelled.', 'success');
        loadHistory();
      }
    } catch (e) {
      showToast('Simulated email open updated', 'info');
    }
  };

  const handleEscalateCall = async (alertItem: EmergencyAlert, specificPhone?: string) => {
    const phoneList = getContactPhoneList(alertItem);
    const targetPhone = specificPhone || phoneList[0] || '';
    autoDialedAlertIds.add(alertItem.id);
    try {
      await triggerAutoCallEscalation(alertItem.id);
      showToast(`📞 Dialing Emergency Contact (${targetPhone})...`, 'error');
      loadHistory();
    } catch (_e) {
      // ignore
    }
    dialContactPhone(targetPhone, alertItem);
  };

  const handleDeleteSingleAlert = async (alertId: string) => {
    try {
      await deleteAlertRecord(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      showToast('Incident record deleted', 'success');
    } catch (e) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      showToast('Incident removed', 'info');
    }
  };

  const handleClearAllHistory = async () => {
    Alert.alert(
      'Clear All Incident History',
      'Are you sure you want to permanently delete all emergency incident logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAlertHistory(userId);
              setAlerts([]);
              showToast('All incident history cleared!', 'success');
            } catch (e) {
              setAlerts([]);
              showToast('History cleared', 'info');
            }
          },
        },
      ]
    );
  };

  const openMap = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  const openTracker = (trackerUrl: string) => {
    if (trackerUrl) {
      Linking.openURL(trackerUrl);
    }
  };

  const getStatusColor = (status: string, emailOpened?: boolean) => {
    if (status === 'ESCALATED_CALL') return '#f43f5e';
    if (emailOpened || status === 'TRACKER_OPENED' || status === 'EMAIL_OPENED') {
      return '#10b981';
    }
    switch (status) {
      case 'DISPATCHED':
        return '#f59e0b';
      case 'CANCELLED':
        return '#64748b';
      default:
        return '#f59e0b';
    }
  };

  const latestActiveAlert: any = alerts[0] || null;
  const latestTimer = latestActiveAlert ? getAlertTimerState(latestActiveAlert) : null;
  const latestPhones = latestActiveAlert ? getContactPhoneList(latestActiveAlert) : [];

  return (
    <View style={styles.container}>
      <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2500} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHistory();
            }}
            tintColor="#38bdf8"
          />
        }>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Emergency Incident Log</Text>
            <Text style={styles.subtitle}>
              Real-time email open tracking & auto-call escalation.
            </Text>
          </View>
          {alerts.length > 0 && (
            <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAllHistory}>
              <Text style={styles.clearAllBtnText}>Clear All 🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Top Live Countdown Banner for Latest Dispatched Emergency Email */}
        {latestActiveAlert && latestTimer && !latestTimer.isCancelled && (
          <View
            style={[
              styles.liveBannerCard,
              latestTimer.isOpened
                ? styles.liveBannerOpened
                : latestTimer.remainingSecs > 0
                ? styles.liveBannerWaiting
                : styles.liveBannerEscalated,
            ]}>
            <View style={styles.liveBannerHeader}>
              <Text style={styles.liveBannerTitle}>
                {latestTimer.isOpened
                  ? '✅ EMERGENCY EMAIL OPENED BY CONTACT'
                  : latestTimer.remainingSecs > 0
                  ? '⏳ WAITING FOR CONTACT TO OPEN EMAIL'
                  : '📞 TIMER EXPIRED — AUTO-DIALING CONTACT'}
              </Text>
              {!latestTimer.isOpened && (
                <View style={styles.countdownPill}>
                  <Text style={styles.countdownPillText}>
                    {latestTimer.remainingSecs}s / {latestTimer.waitLimitSecs}s
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.liveBannerSubtext}>
              {latestTimer.isOpened
                ? `Email opened by ${latestActiveAlert.contactNotifiedEmail || 'Emergency Contact'}. Auto-dial cancelled.`
                : latestTimer.remainingSecs > 0
                ? `If nobody opens the emergency email within ${latestTimer.remainingSecs} seconds, your phone will automatically dial ${latestPhones.join(', ') || 'your emergency contact'}.`
                : `No one opened the email within ${latestTimer.waitLimitSecs}s. Auto-dialing ${latestPhones.join(', ') || 'emergency contact'} now.`}
            </Text>

            {latestPhones.length > 0 && !latestTimer.isOpened && (
              <View style={styles.phoneChipsRow}>
                {latestPhones.map((ph) => (
                  <TouchableOpacity
                    key={ph}
                    style={styles.phoneChipBtn}
                    onPress={() => handleEscalateCall(latestActiveAlert, ph)}>
                    <Text style={styles.phoneChipText}>📞 Dial {ph}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {loading && alerts.length === 0 ? (
          <ActivityIndicator color="#38bdf8" style={{ marginTop: 20 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Emergency Incidents</Text>
            <Text style={styles.emptyText}>
              No crash alerts have been triggered yet. Drive safely!
            </Text>
          </View>
        ) : (
          alerts.map((alert: any) => {
            const {
              waitLimitSecs,
              remainingSecs,
              isOpened,
              isCancelled,
            } = getAlertTimerState(alert);
            const phoneList = getContactPhoneList(alert);
            const targetPhone = phoneList[0] || '';
            const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

            return (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View>
                    <Text style={styles.alertId}>Incident #{alert.id.slice(-6)}</Text>
                    <Text style={styles.alertTime}>
                      {alert.timestampIst ||
                        new Date(alert.timestamp).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                        }) + ' IST'}
                    </Text>
                  </View>
                  <View style={styles.headerBadgeGroup}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: `${getStatusColor(alert.status, isOpened)}20`,
                          borderColor: getStatusColor(alert.status, isOpened),
                        },
                      ]}>
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(alert.status, isOpened) },
                        ]}>
                        {isOpened
                          ? 'EMAIL OPENED'
                          : alert.status === 'ESCALATED_CALL' || remainingSecs === 0
                          ? '📞 AUTO-CALL DIALED'
                          : `⏳ ${remainingSecs}s TIMER`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteSingleBtn}
                      onPress={() => handleDeleteSingleAlert(alert.id)}>
                      <Text style={styles.deleteSingleBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Notified Contact Email & Phone Numbers Display */}
                <View style={styles.recipientInfoBox}>
                  <Text style={styles.recipientLabel}>✉️ Alert Sent To (Emergency Contact):</Text>
                  <Text style={styles.recipientEmail}>
                    {alert.contactNotifiedEmail || primaryContact?.email || 'Primary Emergency Contact'}
                  </Text>
                  {phoneList.length > 0 && (
                    <Text style={styles.recipientPhone}>
                      📞 Contact Number(s): {phoneList.join(' • ')}
                    </Text>
                  )}
                </View>

                {/* Email Open Tracker & Live Countdown Timer Indicator */}
                <View
                  style={[
                    styles.openTrackerCard,
                    isOpened ? styles.openTrackerSuccess : styles.openTrackerPending,
                  ]}>
                  <Text
                    style={[
                      styles.openTrackerTitle,
                      isOpened ? styles.textSuccess : styles.textPending,
                    ]}>
                    {isOpened
                      ? `✅ Email Opened at ${new Date(alert.emailOpenedAt || alert.trackerOpenedAt || Date.now()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST — Auto-Call Cancelled`
                      : isCancelled
                      ? '🛑 Alert Cancelled by User'
                      : remainingSecs > 0
                      ? `⏳ Waiting for Email Open: ${remainingSecs}s / ${waitLimitSecs}s remaining... (Auto-dialing ${targetPhone || 'Contact'} at 0s)`
                      : `📞 Wait Timer (${waitLimitSecs}s) Expired — Auto-Dialed ${targetPhone || 'Emergency Contact'}`}
                  </Text>
                  <View style={styles.actionRow}>
                    {!isOpened && !isCancelled && (
                      <TouchableOpacity
                        style={styles.simulateOpenBtn}
                        onPress={() => handleSimulateOpen(alert.id)}>
                        <Text style={styles.simulateOpenBtnText}>Simulate Email Open</Text>
                      </TouchableOpacity>
                    )}
                    {phoneList.length > 0 ? (
                      phoneList.map((ph) => (
                        <TouchableOpacity
                          key={ph}
                          style={styles.escalateCallBtn}
                          onPress={() => handleEscalateCall(alert, ph)}>
                          <Text style={styles.escalateCallBtnText}>📞 Call {ph}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <TouchableOpacity
                        style={styles.escalateCallBtn}
                        onPress={() => handleEscalateCall(alert)}>
                        <Text style={styles.escalateCallBtnText}>📞 Call Now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Telemetry Snapshot */}
                <View style={styles.telemetryRow}>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>IMPACT FORCE</Text>
                    <Text style={styles.telemetryValue}>
                      {Number(alert.sensorSnapshot?.totalG || 4.2).toFixed(2)} G
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>SPEED AT IMPACT</Text>
                    <Text style={styles.telemetryValue}>
                      {Number(alert.sensorSnapshot?.speedKmh || alert.location?.speed || 45).toFixed(1)} km/h
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() =>
                      openMap(
                        Number(alert.location?.latitude) || 0,
                        Number(alert.location?.longitude) || 0,
                      )
                    }>
                    <Text style={styles.mapBtnText}>Google Maps</Text>
                  </TouchableOpacity>

                  {alert.trackerUrl && (
                    <TouchableOpacity
                      style={styles.trackerBtn}
                      onPress={() => openTracker(alert.trackerUrl)}>
                      <Text style={styles.trackerBtnText}>Live Tracker</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#94a3b8' },
  clearAllBtn: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderWidth: 1,
    borderColor: '#e11d48',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  clearAllBtnText: { color: '#f43f5e', fontSize: 11, fontWeight: 'bold' },
  liveBannerCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  liveBannerWaiting: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: '#f59e0b',
  },
  liveBannerOpened: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10b981',
  },
  liveBannerEscalated: {
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderColor: '#f43f5e',
  },
  liveBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  liveBannerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  countdownPill: {
    backgroundColor: '#020617',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  countdownPillText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: 'bold',
  },
  liveBannerSubtext: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
  phoneChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  phoneChipBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  phoneChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#0f172a',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  alertCard: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alertId: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
  alertTime: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  headerBadgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  deleteSingleBtn: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderWidth: 1,
    borderColor: '#e11d48',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSingleBtnText: { fontSize: 12 },
  recipientInfoBox: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recipientLabel: { fontSize: 10, fontWeight: 'bold', color: '#38bdf8', marginBottom: 2 },
  recipientEmail: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },
  recipientPhone: { fontSize: 11, color: '#cbd5e1', marginTop: 2 },
  openTrackerCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  openTrackerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  openTrackerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#f59e0b',
  },
  openTrackerTitle: { fontSize: 11, fontWeight: 'bold' },
  textSuccess: { color: '#10b981' },
  textPending: { color: '#f59e0b' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 2 },
  simulateOpenBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  simulateOpenBtnText: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },
  escalateCallBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  escalateCallBtnText: { color: '#f43f5e', fontSize: 10, fontWeight: 'bold' },
  telemetryRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  telemetryBox: { flex: 1 },
  telemetryLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  telemetryValue: { fontSize: 15, fontWeight: 'bold', color: '#f43f5e', marginTop: 2 },
  locationTitle: { fontSize: 12, fontWeight: 'bold', color: '#38bdf8', marginBottom: 2 },
  locationAddress: { fontSize: 13, color: '#cbd5e1', marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 8 },
  mapBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  mapBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  trackerBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  trackerBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
});
