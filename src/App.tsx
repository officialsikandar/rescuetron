import React, { useState, useEffect } from 'react';
import { MobileFrame } from './components/MobileFrame';
import { AuthScreens } from './components/AuthScreens';
import { HomeTab } from './components/HomeTab';
import { AlertHistoryTab } from './components/AlertHistoryTab';
import { ProfileTab } from './components/ProfileTab';
import { EmergencyTrackerModal } from './components/EmergencyTrackerModal';
import { NestJsBackendExplorer } from './components/NestJsBackendExplorer';
import { getUserProfile, getAppSettings } from './services/api';
import { socketService } from './services/socketService';
import { AuthState, EmergencyContact, AppSettings, UserProfile } from './types';
import { ShieldAlert, History, User, Activity, MapPin } from 'lucide-react';

export default function App() {
  // Master Auth state with persistent session tracking
  const [authState, setAuthState] = useState<AuthState>({
    token: 'jwt_session_token_101',
    user: {
      id: 'user_demo_101',
      email: 'demo@rescuetron.com',
      fullName: 'Rahul Sharma',
      age: 26,
      phone: '+91 98765 43210',
      bloodGroup: 'O+',
      allergies: 'Penicillin, Dust',
      medicalConditions: 'Mild Asthma',
      medications: 'Inhaler as needed',
      organDonor: true,
      createdAt: new Date().toISOString(),
    },
    isAuthenticated: true,
    emergencyContacts: [
      {
        id: 'contact_1',
        name: 'Priya Sharma (Sister)',
        relationship: 'Sister',
        phone: '+91 98111 22233',
        email: 'priya.emergency@gmail.com',
        isPrimary: true,
      },
    ],
    settings: {
      trackerWaitSeconds: 20,
      gForceSensitivity: 4.5,
      autoCallingEnabled: true,
      soundAlertsEnabled: true,
    },
  });

  // Active Bottom Footer Tab: 'home' | 'history' | 'profile'
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');

  // Developer / NestJS Code Mode
  const [isDevMode, setIsDevMode] = useState(false);

  // Active Emergency Contact Tracker Modal ID
  const [activeTrackerModalId, setActiveTrackerModalId] = useState<string | null>(null);

  // 1. Fetch updated state from MongoDB / Backend DB on app load
  useEffect(() => {
    async function loadDatabaseState() {
      const savedEmail = localStorage.getItem('rescuetron_logged_user_email') || 'demo@rescuetron.com';

      try {
        const [profileRes, settingsRes] = await Promise.all([
          getUserProfile(savedEmail),
          getAppSettings(),
        ]);

        if (profileRes.success && profileRes.user) {
          setAuthState({
            token: localStorage.getItem('rescuetron_token') || 'jwt_session_active',
            user: profileRes.user,
            isAuthenticated: true,
            emergencyContacts: profileRes.emergencyContacts || [],
            settings: settingsRes.settings || profileRes.settings || {
              trackerWaitSeconds: 20,
              gForceSensitivity: 4.5,
              autoCallingEnabled: true,
              soundAlertsEnabled: true,
            },
          });
        }
      } catch (e) {
        console.warn('Initial state fetch error from backend:', e);
      }
    }

    loadDatabaseState();

    // Auto-detect tracker ID from URL parameter (if clicked from email)
    try {
      const params = new URLSearchParams(window.location.search);
      const trackerParam = params.get('tracker');
      if (trackerParam) {
        setActiveTrackerModalId(trackerParam);
      }
    } catch (e) {
      console.warn('URL parsing error:', e);
    }

    // Subscribe to WebSocket updates for real-time contact & settings synchronization
    const unsubscribe = socketService.subscribe((event) => {
      if (event.type === 'SETTINGS_UPDATED' && event.settings) {
        setAuthState((prev) => ({ ...prev, settings: event.settings }));
      }
      if (event.type === 'CONTACTS_UPDATED' && event.contacts) {
        setAuthState((prev) => ({ ...prev, emergencyContacts: event.contacts }));
      }
      if (event.type === 'PROFILE_UPDATED' && event.user) {
        setAuthState((prev) => {
          if (prev.user?.email.toLowerCase() === event.user.email.toLowerCase()) {
            return { ...prev, user: event.user };
          }
          return prev;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handlers
  const handleAuthenticated = (newAuthState: AuthState) => {
    if (newAuthState.user?.email) {
      localStorage.setItem('rescuetron_logged_user_email', newAuthState.user.email);
    }
    if (newAuthState.token) {
      localStorage.setItem('rescuetron_token', newAuthState.token);
    }
    setAuthState(newAuthState);
    setActiveTab('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('rescuetron_logged_user_email');
    localStorage.removeItem('rescuetron_token');
    setAuthState({
      token: null,
      user: null,
      isAuthenticated: false,
      emergencyContacts: [],
    });
    setActiveTab('home');
  };

  const handleProfileUpdated = (updatedContacts: EmergencyContact[]) => {
    setAuthState((prev) => ({
      ...prev,
      emergencyContacts: updatedContacts,
    }));
  };

  const handleUserUpdated = (updatedUser: UserProfile) => {
    setAuthState((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  };

  const handleSettingsUpdated = (newSettings: AppSettings) => {
    setAuthState((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  };

  return (
    <MobileFrame
      isDevMode={isDevMode}
      onToggleDevMode={() => setIsDevMode(!isDevMode)}
    >
      {/* 1. Developer NestJS & Firebase API Architecture View */}
      {isDevMode ? (
        <NestJsBackendExplorer />
      ) : (
        /* 2. Mobile App Interface */
        <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
          {!authState.isAuthenticated ? (
            /* Auth Screens (Welcome -> Login / Signup with Email OTP -> Profile) */
            <AuthScreens onAuthenticated={handleAuthenticated} />
          ) : (
            /* Main Authenticated App with 3 Bottom Footer Tabs */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Tab Header Bar */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs z-30 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-rose-950">
                    R
                  </div>
                  <div>
                    <h1 className="font-bold text-white leading-none">Rescuetron</h1>
                    <span className="text-[10px] text-emerald-400 font-mono">Database Synced</span>
                  </div>
                </div>

                <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>MongoDB / Realtime</span>
                </span>
              </div>

              {/* Tab Screen Area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col scrollbar-thin scrollbar-thumb-slate-800">
                {activeTab === 'home' && (
                  <HomeTab
                    authState={authState}
                    onAlertTriggered={() => setActiveTab('history')}
                    onUpdateSettings={(waitSecs) => {
                      setAuthState((prev) => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {
                            gForceSensitivity: 4.5,
                            autoCallingEnabled: true,
                            soundAlertsEnabled: true,
                          }),
                          trackerWaitSeconds: waitSecs,
                        },
                      }));
                    }}
                  />
                )}

                {activeTab === 'history' && (
                  <AlertHistoryTab
                    authState={authState}
                    onOpenTrackerModal={(trackerId) => setActiveTrackerModalId(trackerId)}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileTab
                    authState={authState}
                    onLogout={handleLogout}
                    onProfileUpdated={handleProfileUpdated}
                    onUserUpdated={handleUserUpdated}
                    onSettingsUpdated={handleSettingsUpdated}
                  />
                )}
              </div>

              {/* 3 Bottom Footer Navigation Tabs */}
              <div className="bg-slate-900 border-t border-slate-800 grid grid-cols-3 py-1.5 px-2 z-40 shrink-0">
                {/* 1st Footer Tab: Home & Sensors */}
                <button
                  onClick={() => setActiveTab('home')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl transition text-[10px] font-semibold ${
                    activeTab === 'home'
                      ? 'text-rose-400 bg-rose-950/40 border border-rose-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-4 h-4 mb-0.5" />
                  <span>Sensors & SOS</span>
                </button>

                {/* 2nd Footer Tab: Alert History */}
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl transition text-[10px] font-semibold ${
                    activeTab === 'history'
                      ? 'text-rose-400 bg-rose-950/40 border border-rose-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4 mb-0.5" />
                  <span>Alert History</span>
                </button>

                {/* 3rd Footer Tab: Profile & Settings */}
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl transition text-[10px] font-semibold ${
                    activeTab === 'profile'
                      ? 'text-rose-400 bg-rose-950/40 border border-rose-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-4 h-4 mb-0.5" />
                  <span>Profile & Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Emergency Tracker Modal Overlay */}
          {activeTrackerModalId && (
            <EmergencyTrackerModal
              trackerId={activeTrackerModalId}
              onClose={() => setActiveTrackerModalId(null)}
            />
          )}
        </div>
      )}
    </MobileFrame>
  );
}
