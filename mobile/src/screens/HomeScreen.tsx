import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { AuthState } from '../types';
import {
  dispatchEmergencyAlert,
  getAppSettings,
  saveAppSettings,
  getAlertStatus,
  simulateEmailOpen,
  triggerAutoCallEscalation,
  cancelEmergencyAlert,
} from '../services/api';
import { initWebSocket, sendWsMessage, subscribeWs } from '../services/websocket';
import { Toast } from '../components/Toast';

interface HomeScreenProps {
  authState: AuthState;
  onAlertTriggered: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ authState, onAlertTriggered }) => {
  const [gForce, setGForce] = useState(1.0);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string }>({
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'Connaught Place, New Delhi, India',
  });

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Crash detection & Countdown
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Active Emergency Alert Tracking (Same as Web)
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Dynamic Settings
  const [customWaitSeconds, setCustomWaitSeconds] = useState(20);
  const [savingSettings, setSavingSettings] = useState(false);

  const pollTimerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);

  // Initialize WebSocket and Listen for Real-Time Email Open & Alert Events
  useEffect(() => {
    initWebSocket();
    const unsubscribe = subscribeWs((event) => {
      if (event.type === 'EMERGENCY_ALERT') {
        console.log('⚡ WebSocket Alert Broadcast Received:', event);
      }
      if (event.type === 'EMAIL_OPENED' && event.alert) {
        console.log('⚡ [Mobile WebSocket] Email Opened Event Caught!', event.alert);
        setActiveAlert(event.alert);
        showToast('✉️ Emergency Contact Opened Track Link!', 'success');
      }
      if (event.type === 'SETTINGS_UPDATED' && event.settings?.trackerWaitSeconds) {
        setCustomWaitSeconds(event.settings.trackerWaitSeconds);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch Settings on Mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getAppSettings();
        if (res?.settings?.trackerWaitSeconds) {
          setCustomWaitSeconds(res.settings.trackerWaitSeconds);
        }
      } catch (e) {
        // default 20s
      }
    })();
  }, []);

  // Polling for Email Open Status when Alert is Active (Same as Web)
  useEffect(() => {
    if (activeAlertId) {
      const pollStatus = async () => {
        try {
          const res = await getAlertStatus(activeAlertId);
          if (res.success && res.alert) {
            setActiveAlert(res.alert);
          }
        } catch (e) {
          // ignore
        }
      };

      pollStatus();
      pollTimerRef.current = setInterval(pollStatus, 1500);

      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [activeAlertId]);

  const handleSaveWaitSeconds = async (newVal: number) => {
    const validVal = Math.max(5, Math.min(300, newVal || 20));
    setCustomWaitSeconds(validVal);
    setSavingSettings(true);
    try {
      const res = await saveAppSettings({
        userId: authState.user?.id,
        email: authState.user?.email,
        trackerWaitSeconds: validVal,
      });
      if (res.success || res.settings) {
        showToast(`Escalation wait set to ${validVal}s`, 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCycleWaitTime = () => {
    const presets = [10, 20, 30, 60];
    const currentIndex = presets.indexOf(customWaitSeconds);
    const nextSec =
      currentIndex >= 0 && currentIndex < presets.length - 1
        ? presets[currentIndex + 1]
        : presets[0];
    handleSaveWaitSeconds(nextSec);
  };

  // Accelerometer Sensor Integration
  useEffect(() => {
    let subscription: any;
    Accelerometer.setUpdateInterval(200);

    subscription = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const mag = Math.sqrt(x * x + y * y + z * z);
      const formattedG = parseFloat(mag.toFixed(2));
      setGForce(formattedG);

      // Stream live telemetry over WebSocket
      if (formattedG > 1.8) {
        sendWsMessage('TELEMETRY_UPDATE', {
          userId: authState.user?.id,
          gForce: formattedG,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }

      if (mag > 4.5 && !isAlertActive && !activeAlertId) {
        triggerCrashCountdown();
      }
    });

    return () => {
      subscription && subscription.remove();
    };
  }, [isAlertActive, activeAlertId, location, authState]);

  // Location Fetcher
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          address: `Lat: ${loc.coords.latitude.toFixed(4)}, Lon: ${loc.coords.longitude.toFixed(4)}`,
        });
      }
    })();
  }, []);

  const triggerCrashCountdown = () => {
    setIsAlertActive(true);
    setCountdown(10);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAlertActive && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (isAlertActive && countdown === 0) {
      handleConfirmDispatch();
    }
    return () => clearTimeout(timer);
  }, [isAlertActive, countdown]);

  const handleConfirmDispatch = async () => {
    setIsAlertActive(false);
    setIsDispatching(true);
    try {
      const res = await dispatchEmergencyAlert({
        userId: authState.user?.id || 'demo_user',
        userEmail: authState.user?.email,
        userName: authState.user?.fullName || authState.user?.name,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        gForce: gForce,
        speedKmh: 48.5,
      });

      setIsDispatching(false);

      if (res?.success || res?.alert) {
        const newAlert = res.alert || { id: `alt_${Date.now()}` };
        setActiveAlertId(newAlert.id);
        setActiveAlert(newAlert);
        setElapsedSeconds(0);
        showToast('🚨 Emergency SOS Alert Dispatched via Brevo!', 'error');

        // Broadcast over WebSocket
        sendWsMessage('EMERGENCY_ALERT_TRIGGERED', {
          userId: authState.user?.id,
          userEmail: authState.user?.email,
          alertId: newAlert.id,
          latitude: location.latitude,
          longitude: location.longitude,
          gForce: gForce,
        });

        onAlertTriggered();
      }
    } catch (err) {
      setIsDispatching(false);
      showToast('Emergency SOS dispatched locally', 'info');
    }
  };

  const handleSimulateEmailOpen = async () => {
    if (activeAlertId) {
      const res = await simulateEmailOpen(activeAlertId);
      if (res.success && res.alert) {
        setActiveAlert(res.alert);
        showToast('✉️ Contact opened tracking email!', 'success');
      }
    }
  };

  const handleSimulateCallEscalation = async () => {
    if (activeAlertId) {
      await triggerAutoCallEscalation(activeAlertId);
      showToast('📞 Automated Call Escalation Triggered!', 'error');
    }
  };

  const handleCancelAlert = async () => {
    if (activeAlertId) {
      await cancelEmergencyAlert(activeAlertId);
      setActiveAlertId(null);
      setActiveAlert(null);
      showToast('Alert Cancelled - Safe Mode Restored', 'info');
    }
  };

  const primaryContact =
    authState.emergencyContacts?.find((c) => c.isPrimary) ||
    authState.emergencyContacts?.[0] || {
      name: 'Primary Contact',
      email: authState.user?.email || 'sikandaritguy@gmail.com',
      phone: '+91 98111 22233',
    };

  const isOpened = Boolean(activeAlert?.openedAt || activeAlert?.opened);
  const isEscalated = elapsedSeconds > customWaitSeconds && !isOpened;

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2000} />

          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Rescuetron Sensor Monitor</Text>
          <Text style={styles.subtitle}>Real-time Impact & GPS Tracking</Text>
        </View>

        {/* Sensor Meter Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accelerometer Telemetry</Text>
          <View style={styles.sensorRow}>
            <Text style={styles.sensorValue}>{gForce} G</Text>
            <Text style={styles.sensorStatus}>
              {gForce > 4.5 ? 'CRASH IMPACT DETECTED' : 'NORMAL MOVEMENTS'}
            </Text>
          </View>

          <TouchableOpacity style={styles.simButton} onPress={triggerCrashCountdown}>
            <Text style={styles.simButtonText}>Simulate High-Impact Crash (4.5G+)</Text>
          </TouchableOpacity>
        </View>

        {/* ACTIVE EMAIL WAITING STATUS BANNER (EXACTLY SAME AS WEB) */}
        {activeAlertId && (
          <View style={[styles.card, styles.alertTrackingCard]}>
            <View style={styles.trackingHeaderRow}>
              <Text style={styles.alertHeaderTitle}>🚨 ACTIVE SOS ALERT DISPATCHED</Text>
              <View style={styles.liveTimerBadge}>
                <Text style={styles.liveTimerText}>{elapsedSeconds}s Elapsed</Text>
              </View>
            </View>

            {/* Email Waiting Status Badge */}
            <View style={styles.statusBadgeBox}>
              {isOpened ? (
                <View style={styles.statusBadgeOpened}>
                  <Text style={styles.statusTextOpened}>
                    ✅ TRACKING LINK OPENED BY CONTACT
                  </Text>
                  <Text style={styles.statusSubtext}>
                    Opened at: {activeAlert?.openedAt || 'Just now'} — Call escalation cancelled.
                  </Text>
                </View>
              ) : isEscalated ? (
                <View style={styles.statusBadgeEscalated}>
                  <Text style={styles.statusTextEscalated}>
                    📞 WAIT WINDOW EXPIRED ({customWaitSeconds}s) — AUTOMATED CALL TRIGGERED
                  </Text>
                  <Text style={styles.statusSubtext}>
                    Email was not opened within {customWaitSeconds}s. Automated call initiated.
                  </Text>
                </View>
              ) : (
                <View style={styles.statusBadgeWaiting}>
                  <Text style={styles.statusTextWaiting}>
                    ⏳ WAITING FOR CONTACT TO OPEN EMAIL ({elapsedSeconds}/{customWaitSeconds}s)
                  </Text>
                  <Text style={styles.statusSubtext}>
                    Dispatched to {primaryContact.email}. Automated call in {Math.max(0, customWaitSeconds - elapsedSeconds)}s.
                  </Text>
                </View>
              )}
            </View>

            {/* Target Contact Details */}
            <View style={styles.contactDetailsBox}>
              <Text style={styles.contactDetailLabel}>Primary Emergency Contact:</Text>
              <Text style={styles.contactDetailVal}>👤 {primaryContact.name || 'Emergency Contact'}</Text>
              <Text style={styles.contactDetailVal}>✉️ {primaryContact.email}</Text>
              <Text style={styles.contactDetailVal}>📞 {primaryContact.phone}</Text>
            </View>

            {/* Action Buttons for Email Waiting Status */}
            <View style={styles.trackingActionsRow}>
              {!isOpened && (
                <TouchableOpacity style={styles.simOpenBtn} onPress={handleSimulateEmailOpen}>
                  <Text style={styles.simOpenBtnText}>✉️ Simulate Email Open (Test)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.simEscalateBtn}
                onPress={handleSimulateCallEscalation}>
                <Text style={styles.simEscalateBtnText}>📞 Test Call Escalation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelAlertBtn} onPress={handleCancelAlert}>
                <Text style={styles.cancelAlertBtnText}>I AM SAFE - CANCEL ALERT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Escalation Wait Time Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Response Countdown Setting</Text>
          <Text style={styles.cardSubtitle}>
            Seconds to wait for email open before triggering automated emergency call escalation
          </Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Current Wait Duration:</Text>
            <Text style={styles.settingVal}>{customWaitSeconds} Seconds</Text>
          </View>

          <View style={styles.presetRow}>
            {[10, 20, 30, 60].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.presetChip,
                  customWaitSeconds === sec && styles.presetChipActive,
                ]}
                onPress={() => handleSaveWaitSeconds(sec)}>
                <Text
                  style={[
                    styles.presetChipText,
                    customWaitSeconds === sec && styles.presetChipTextActive,
                  ]}>
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customInputRow}>
            <TextInput
              style={styles.timeInput}
              keyboardType="number-pad"
              value={String(customWaitSeconds)}
              onChangeText={(txt) => setCustomWaitSeconds(parseInt(txt, 10) || 0)}
              onEndEditing={() => handleSaveWaitSeconds(customWaitSeconds)}
              placeholder="Seconds"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={styles.cycleBtn}
              onPress={handleCycleWaitTime}
              disabled={savingSettings}>
              {savingSettings ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <Text style={styles.cycleBtnText}>Cycle Presets (10/20/30/60s)</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* GPS Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS Location Status</Text>
          <Text style={styles.locationText}>{location.address}</Text>
        </View>

        {/* Emergency Countdown Modal Banner */}
        {isAlertActive && (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>🚨 CRASH DETECTED!</Text>
            <Text style={styles.bannerText}>
              Dispatching emergency alert in {countdown} seconds...
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setIsAlertActive(false);
                showToast('Countdown Cancelled', 'info');
              }}>
              <Text style={styles.cancelBtnText}>I AM SAFE - CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#020617' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  header: { marginBottom: 16 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  alertTrackingCard: {
    borderColor: '#f43f5e',
    backgroundColor: '#111827',
    borderWidth: 1.5,
  },
  trackingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertHeaderTitle: { color: '#f43f5e', fontSize: 13, fontWeight: 'bold' },
  liveTimerBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveTimerText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  statusBadgeBox: { marginBottom: 12 },
  statusBadgeWaiting: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    padding: 10,
    borderRadius: 10,
  },
  statusTextWaiting: { color: '#facc15', fontWeight: 'bold', fontSize: 12 },
  statusBadgeOpened: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    padding: 10,
    borderRadius: 10,
  },
  statusTextOpened: { color: '#34d399', fontWeight: 'bold', fontSize: 12 },
  statusBadgeEscalated: {
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    borderWidth: 1,
    borderColor: '#e11d48',
    padding: 10,
    borderRadius: 10,
  },
  statusTextEscalated: { color: '#f43f5e', fontWeight: 'bold', fontSize: 12 },
  statusSubtext: { color: '#cbd5e1', fontSize: 11, marginTop: 4 },
  contactDetailsBox: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  contactDetailLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  contactDetailVal: { color: '#f8fafc', fontSize: 12, marginTop: 2 },
  trackingActionsRow: { gap: 8 },
  simOpenBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  simOpenBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  simEscalateBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  simEscalateBtnText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
  cancelAlertBtn: {
    backgroundColor: '#e11d48',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelAlertBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  cardTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  cardSubtitle: { color: '#64748b', fontSize: 11, marginBottom: 12 },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sensorValue: { color: '#38bdf8', fontSize: 32, fontWeight: 'bold' },
  sensorStatus: { color: '#34d399', fontSize: 11, fontWeight: 'bold' },
  simButton: {
    backgroundColor: '#e11d48',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  simButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  settingLabel: { color: '#94a3b8', fontSize: 12 },
  settingVal: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.15)' },
  presetChipText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  presetChipTextActive: { color: '#38bdf8' },
  customInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  timeInput: {
    width: 70,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#f8fafc',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  cycleBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cycleBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  locationText: { color: '#94a3b8', fontSize: 12 },
  banner: {
    backgroundColor: '#e11d48',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  bannerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  bannerText: { color: '#ffffff', fontSize: 13, marginVertical: 6 },
  cancelBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  cancelBtnText: { color: '#e11d48', fontWeight: 'bold', fontSize: 12 },
});
