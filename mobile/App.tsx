import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { MedicalProfileScreen } from './src/screens/MedicalProfileScreen';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { AlertHistoryScreen } from './src/screens/AlertHistoryScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { NetworkLogsModal } from './src/components/NetworkLogsModal';
import { UserProfile, EmergencyAlert } from './src/types';
import { getUserSession, clearUserSession, saveUserSession, StoredSession } from './src/services/storage';
import { setAuthToken } from './src/services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'medical' | 'contacts' | 'history'>('telemetry');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [latestDispatchedAlert, setLatestDispatchedAlert] = useState<EmergencyAlert | null>(null);

  // Prevent bottom tab bar from scrolling up when keyboard opens
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load session from Storage on App Mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await getUserSession();
        if (stored && stored.isAuthenticated && stored.user) {
          setSession(stored);
          setAuthToken(stored.token);
        }
      } catch (e) {
        console.error('Session load failed:', e);
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  const handleLoginSuccess = (newSession: StoredSession) => {
    setSession(newSession);
    setAuthToken(newSession.token);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to log out? Session will be removed from local storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await clearUserSession();
            setAuthToken(null);
            setSession(null);
            setActiveTab('telemetry');
          },
        },
      ]
    );
  };

  if (loadingSession) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text style={styles.loadingText}>Initializing Rescuetron Mobile...</Text>
      </SafeAreaView>
    );
  }

  if (!session || !session.isAuthenticated || !session.user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <AuthScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  const { user } = session;

  const authState = {
    token: session.token,
    user,
    isAuthenticated: true,
    emergencyContacts: [],
  };

  const handleProfileUpdated = async (updatedUser: UserProfile) => {
    const updatedSession: StoredSession = {
      ...session,
      user: updatedUser,
    };
    setSession(updatedSession);
    await saveUserSession(updatedSession);
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'telemetry':
        return (
          <HomeScreen
            authState={authState}
            onAlertTriggered={(dispatchedAlert) => {
              if (dispatchedAlert) {
                setLatestDispatchedAlert(dispatchedAlert);
              }
              setActiveTab('history');
            }}
          />
        );
      case 'medical':
        return (
          <MedicalProfileScreen
            user={user}
            onProfileUpdated={handleProfileUpdated}
          />
        );
      case 'contacts':
        return <ContactsScreen userId={user.id} />;
      case 'history':
        return (
          <AlertHistoryScreen
            userId={user.id}
            latestDispatchedAlert={latestDispatchedAlert}
          />
        );
      default:
        return (
          <HomeScreen
            authState={authState}
            onAlertTriggered={(dispatchedAlert) => {
              if (dispatchedAlert) {
                setLatestDispatchedAlert(dispatchedAlert);
              }
              setActiveTab('history');
            }}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      {/* App Header */}
      <View style={styles.appBar}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>⚡ RESCUETRON</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ONLINE</Text>
          </View>
        </View>

        <View style={styles.userSection}>
          <TouchableOpacity
            style={styles.logsBtnHeader}
            onPress={() => setShowLogsModal(true)}>
            <Text style={styles.logsBtnHeaderText}>📋 Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Logout 🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.body}>{renderActiveScreen()}</View>

      {/* Bottom Navigation Bar (hidden when keyboard is open so it never scrolls up) */}
      {!isKeyboardVisible && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'telemetry' && styles.tabItemActive]}
            onPress={() => setActiveTab('telemetry')}>
            <Text style={styles.tabIcon}>📡</Text>
            <Text style={[styles.tabLabel, activeTab === 'telemetry' && styles.tabLabelActive]}>
              Sensors
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'medical' && styles.tabItemActive]}
            onPress={() => setActiveTab('medical')}>
            <Text style={styles.tabIcon}>🩺</Text>
            <Text style={[styles.tabLabel, activeTab === 'medical' && styles.tabLabelActive]}>
              Medical ID
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'contacts' && styles.tabItemActive]}
            onPress={() => setActiveTab('contacts')}>
            <Text style={styles.tabIcon}>📞</Text>
            <Text style={[styles.tabLabel, activeTab === 'contacts' && styles.tabLabelActive]}>
              Contacts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}>
            <Text style={styles.tabIcon}>📜</Text>
            <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>
              Incidents
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <NetworkLogsModal
        visible={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
  },
  appBar: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logsBtnHeader: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logsBtnHeaderText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    borderWidth: 1,
    borderColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 28 : 22,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#38bdf8',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
});
