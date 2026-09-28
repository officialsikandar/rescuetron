import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { AuthState } from '../types';
import { dispatchEmergencyAlert, getAppSettings, saveAppSettings } from '../services/api';
import { initWebSocket, sendWsMessage, subscribeWs } from '../services/websocket';

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
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Settings State
  const [customWaitSeconds, setCustomWaitSeconds] = useState(20);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dbSaveNotice, setDbSaveNotice] = useState<string | null>(null);

  // Initialize WebSocket and Listen for Server Broadcasts
  useEffect(() => {
    initWebSocket();
    const unsubscribe = subscribeWs((event) => {
      if (event.type === 'EMERGENCY_ALERT') {
        console.log('⚡ WebSocket Alert Broadcast Received:', event);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAppSettings();
        if (res?.settings?.trackerWaitSeconds) {
          setCustomWaitSeconds(res.settings.trackerWaitSeconds);
        }
      } catch (e) {
        // use default 20s
      }
    })();
  }, []);

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
        setDbSaveNotice(`Saved to MongoDB & DB: ${validVal}s`);
        setTimeout(() => setDbSaveNotice(null), 3000);
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
    const nextSec = currentIndex >= 0 && currentIndex < presets.length - 1 ? presets[currentIndex + 1] : presets[0];
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

      if (mag > 4.5 && !isAlertActive) {
        triggerCrashCountdown();
      }
    });

    return () => {
      subscription && subscription.remove();
    };
  }, [isAlertActive, location, authState]);

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
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isAlertActive && countdown === 0) {
      handleConfirmDispatch();
    }
    return () => clearTimeout(timer);
  }, [isAlertActive, countdown]);

  const handleConfirmDispatch = async () => {
    setIsAlertActive(false);
    try {
      // 1. Dispatch REST API
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

      // 2. Broadcast over WebSocket
      sendWsMessage('EMERGENCY_ALERT_TRIGGERED', {
        userId: authState.user?.id,
        userEmail: authState.user?.email,
        alertId: res?.alert?.id || 'alt_' + Date.now(),
        latitude: location.latitude,
        longitude: location.longitude,
        gForce: gForce,
      });

      Alert.alert('🚨 Emergency Dispatched', 'Emergency contacts and live tracker link have been dispatched.');
      onAlertTriggered();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScrollView style={styles.container}>
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

      {/* Escalation Wait Time Settings Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Response Countdown Setting</Text>
        <Text style={styles.cardSubtitle}>
          Seconds to wait before triggering automated emergency call escalation
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

        {dbSaveNotice && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>✓ {dbSaveNotice}</Text>
          </View>
        )}
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
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAlertActive(false)}>
            <Text style={styles.cancelBtnText}>I AM SAFE - CANCEL</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 12,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sensorValue: {
    color: '#38bdf8',
    fontSize: 32,
    fontWeight: 'bold',
  },
  sensorStatus: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  simButton: {
    backgroundColor: '#e11d48',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  simButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  settingVal: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  presetChipTextActive: {
    color: '#38bdf8',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
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
  cycleBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  noticeBox: {
    marginTop: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: 8,
    borderRadius: 6,
  },
  noticeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  locationText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  banner: {
    backgroundColor: '#e11d48',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    marginVertical: 6,
  },
  cancelBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#e11d48',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
