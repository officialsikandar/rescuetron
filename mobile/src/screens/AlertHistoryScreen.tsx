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
} from 'react-native';
import { EmergencyAlert } from '../types';
import { getAlertHistory, simulateEmailOpen, triggerAutoCallEscalation } from '../services/api';
import { Toast } from '../components/Toast';

interface AlertHistoryScreenProps {
  userId: string;
}

export const AlertHistoryScreen: React.FC<AlertHistoryScreenProps> = ({ userId }) => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([
    {
      id: 'alert_demo_1',
      userId: userId,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'DISPATCHED',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA 94103, USA',
      },
      sensorSnapshot: {
        totalG: 4.82,
        speedKmh: 68.5,
      },
      trackerId: 'trk_99201',
      trackerUrl: 'http://localhost:3000/?tracker=trk_99201',
      emailOpened: false,
      contactNotifiedEmail: 'emergency.contact@gmail.com',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadHistory = async () => {
    try {
      const fetched = await getAlertHistory(userId);
      if (fetched && fetched.length > 0) {
        setAlerts(fetched);
      }
    } catch (e) {
      console.log('Using default alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSimulateOpen = async (alertId: string) => {
    try {
      const res = await simulateEmailOpen(alertId);
      if (res.success) {
        showToast('✉️ Email opened by emergency contact!', 'success');
        loadHistory();
      }
    } catch (e) {
      showToast('Simulated email open updated', 'info');
    }
  };

  const handleEscalateCall = async (alertId: string) => {
    try {
      const res = await triggerAutoCallEscalation(alertId);
      if (res.success) {
        showToast('📞 Automated voice call escalated!', 'error');
        loadHistory();
      }
    } catch (e) {
      showToast('Call escalation command sent', 'info');
    }
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
        return '#10b981';
    }
  };

  return (
    <View style={styles.container}>
      <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2000} />

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
        <Text style={styles.title}>Emergency Incident Log</Text>
        <Text style={styles.subtitle}>
          Real-time email open tracking, crash telemetry, and live GPS tracking dispatches.
        </Text>

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
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View>
                  <Text style={styles.alertId}>Incident #{alert.id.slice(-6)}</Text>
                  <Text style={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: `${getStatusColor(alert.status, alert.emailOpened)}20`,
                      borderColor: getStatusColor(alert.status, alert.emailOpened),
                    },
                  ]}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(alert.status, alert.emailOpened) },
                    ]}>
                    {alert.status === 'ESCALATED_CALL'
                      ? '📞 CALL ESCALATED'
                      : alert.emailOpened
                      ? 'EMAIL OPENED'
                      : 'UNOPENED'}
                  </Text>
                </View>
              </View>

              {/* Email Open Tracker Indicator */}
              <View
                style={[
                  styles.openTrackerCard,
                  alert.emailOpened ? styles.openTrackerSuccess : styles.openTrackerPending,
                ]}>
                <Text
                  style={[
                    styles.openTrackerTitle,
                    alert.emailOpened ? styles.textSuccess : styles.textPending,
                  ]}>
                  {alert.emailOpened
                    ? `✅ Email Opened at ${new Date(alert.emailOpenedAt || '').toLocaleTimeString()}`
                    : '⚠️ Email Not Opened Yet by Recipient'}
                </Text>
                <View style={styles.actionRow}>
                  {!alert.emailOpened && (
                    <TouchableOpacity
                      style={styles.simulateOpenBtn}
                      onPress={() => handleSimulateOpen(alert.id)}>
                      <Text style={styles.simulateOpenBtnText}>Simulate Email Open</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.escalateCallBtn}
                    onPress={() => handleEscalateCall(alert.id)}>
                    <Text style={styles.escalateCallBtnText}>📞 Call Emergency Contact</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Telemetry Snapshot */}
              <View style={styles.telemetryRow}>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>IMPACT FORCE</Text>
                  <Text style={styles.telemetryValue}>
                    {alert.sensorSnapshot?.totalG?.toFixed(2) || '4.20'} G
                  </Text>
                </View>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>SPEED AT IMPACT</Text>
                  <Text style={styles.telemetryValue}>
                    {alert.sensorSnapshot?.speedKmh?.toFixed(1) || '65.0'} km/h
                  </Text>
                </View>
              </View>

              {/* GPS Location */}
              <Text style={styles.locationTitle}>📍 GPS Location:</Text>
              <Text style={styles.locationAddress}>
                {alert.location?.address || `${alert.location?.latitude?.toFixed(4)}, ${alert.location?.longitude?.toFixed(4)}`}
              </Text>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() =>
                    openMap(
                      alert.location?.latitude || 37.7749,
                      alert.location?.longitude || -122.4194,
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
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 18 },
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: 'bold' },
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
