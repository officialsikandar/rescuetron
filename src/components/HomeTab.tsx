import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Activity,
  Zap,
  ShieldCheck,
  AlertOctagon,
  PhoneCall,
  Check,
  RefreshCw,
  Mail,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Phone,
  Send,
  Sliders,
  Radio,
  Sparkles
} from 'lucide-react';
import { updateLocation, triggerEmergencyAlert, cancelEmergencyAlert, getAlertStatus, simulateEmailOpen, saveAppSettings } from '../services/api';
import { socketService } from '../services/socketService';
import { AlertRecord, AuthState, LocationData, SensorData } from '../types';

interface HomeTabProps {
  authState: AuthState;
  onAlertTriggered: () => void;
  onUpdateSettings?: (newWaitSeconds: number) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ authState, onAlertTriggered, onUpdateSettings }) => {
  // Location state
  const [location, setLocation] = useState<LocationData>({
    latitude: 28.6139,
    longitude: 77.209,
    address: 'Connaught Place, New Delhi, India',
    accuracy: 10,
    speed: 38.5,
    timestamp: new Date().toISOString(),
  });
  const [locLoading, setLocLoading] = useState(false);

  // Sensor telemetry state
  const [sensor, setSensor] = useState<SensorData>({
    accelX: 0.12,
    accelY: 0.45,
    accelZ: 9.81,
    totalG: 1.0,
    gyroAlpha: 14.2,
    gyroBeta: 2.1,
    gyroGamma: 0.8,
    impactDetected: false,
    timestamp: new Date().toISOString(),
  });

  // Simulator controls
  const [simSpeed, setSimSpeed] = useState(48);
  const [simGForce, setSimGForce] = useState(1.2);

  // Dynamic Settings for wait time (Configurable)
  const dynamicWaitSeconds = authState.settings?.trackerWaitSeconds || 20;
  const [customWaitSeconds, setCustomWaitSeconds] = useState(dynamicWaitSeconds);
  const [savingSettings, setSavingSettings] = useState(false);

  // Crash detection & Countdown overlay
  const [isCrashActive, setIsCrashActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<AlertRecord | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [socketConnected, setSocketConnected] = useState(true);

  const countdownTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    if (authState.settings?.trackerWaitSeconds) {
      setCustomWaitSeconds(authState.settings.trackerWaitSeconds);
    }
  }, [authState.settings?.trackerWaitSeconds]);

  // 1. Subscribe to Real-Time WebSocket for instant Email Open events!
  useEffect(() => {
    const unsubscribe = socketService.subscribe((event) => {
      if (event.type === 'WS_CONNECTED') {
        setSocketConnected(true);
      }

      if (event.type === 'EMAIL_OPENED' && event.alert) {
        console.log('⚡ [HomeTab WebSocket] Instant Email Open Event Caught!', event);
        setActiveAlert(event.alert);
        setActiveAlertId(event.alert.id);
      }

      if (event.type === 'SETTINGS_UPDATED' && event.settings?.trackerWaitSeconds) {
        setCustomWaitSeconds(event.settings.trackerWaitSeconds);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Fetch Location on Mount & Update DB
  const fetchCurrentLocation = () => {
    setLocLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc: LocationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 10,
            speed: pos.coords.speed ? pos.coords.speed * 3.6 : simSpeed,
            address: `Lat ${pos.coords.latitude.toFixed(4)}°, Lng ${pos.coords.longitude.toFixed(4)}°`,
            timestamp: new Date().toISOString(),
          };
          setLocation(newLoc);
          setLocLoading(false);

          if (authState.user?.id) {
            updateLocation({
              userId: authState.user.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              address: newLoc.address,
              speed: newLoc.speed,
            });
          }
        },
        (err) => {
          console.warn('Geolocation fallback:', err.message);
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (mapContainerRef.current && !leafletMapRef.current && (window as any).L) {
      const L = (window as any).L;
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([location.latitude, location.longitude], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const customIcon = L.divIcon({
        className: 'custom-vehicle-pin',
        html: `<div class="w-7 h-7 bg-rose-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white font-bold text-xs animate-pulse">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([location.latitude, location.longitude], { icon: customIcon }).addTo(map);
      leafletMapRef.current = map;
    } else if (leafletMapRef.current && (window as any).L) {
      leafletMapRef.current.setView([location.latitude, location.longitude], 15);
    }
  }, [location.latitude, location.longitude]);

  // Real DeviceMotion Event Listener
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity) {
        const x = event.accelerationIncludingGravity.x || 0;
        const y = event.accelerationIncludingGravity.y || 0;
        const z = event.accelerationIncludingGravity.z || 9.81;
        const totalAccel = Math.sqrt(x * x + y * y + z * z);
        const gForce = parseFloat((totalAccel / 9.81).toFixed(2));
        const threshold = authState.settings?.gForceSensitivity || 4.5;

        setSensor((prev) => ({
          ...prev,
          accelX: parseFloat(x.toFixed(2)),
          accelY: parseFloat(y.toFixed(2)),
          accelZ: parseFloat(z.toFixed(2)),
          totalG: gForce,
          impactDetected: gForce > threshold,
          timestamp: new Date().toISOString(),
        }));

        if (gForce > threshold && !isCrashActive && !activeAlertId) {
          triggerCrashDetectionSequence(gForce);
        }
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, [isCrashActive, activeAlertId, authState.settings?.gForceSensitivity]);

  // Crash Trigger Function
  const triggerCrashDetectionSequence = (forcedG?: number) => {
    const impactG = forcedG || 6.4;
    setSensor((prev) => ({
      ...prev,
      totalG: impactG,
      accelX: 8.5,
      accelY: -12.4,
      accelZ: 2.1,
      impactDetected: true,
    }));

    setIsCrashActive(true);
    setCountdown(10);
    setDispatchStatus(null);
  };

  // Countdown Interval logic
  useEffect(() => {
    if (isCrashActive && countdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isCrashActive && countdown === 0) {
      executeEmergencyAlertDispatch();
    }
    return () => clearTimeout(countdownTimerRef.current);
  }, [isCrashActive, countdown]);

  // Live polling backup alongside WebSocket for Email Open Status
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

  // Execute Dispatch Call to Backend (Dispatches real Gmail SMTP email)
  const executeEmergencyAlertDispatch = async () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setIsDispatching(true);
    setDispatchStatus('Sending Emergency SOS email via Gmail SMTP...');

    const primaryContact = authState.emergencyContacts.find((c) => c.isPrimary) || authState.emergencyContacts[0] || {
      email: authState.user?.email || 'sikandaritguy@gmail.com',
      phone: '+91 98111 22233',
    };

    try {
      const res = await triggerEmergencyAlert({
        userId: authState.user?.id || 'user_demo_101',
        userEmail: authState.user?.email || 'sikandaritguy@gmail.com',
        userName: authState.user?.fullName || 'Rahul Sharma',
        location,
        sensorSnapshot: sensor,
        contactEmail: primaryContact.email,
        contactPhone: primaryContact.phone || '+91 98111 22233',
      });

      if (res.success) {
        setActiveAlertId(res.alert?.id);
        setActiveAlert(res.alert);
        setElapsedSeconds(0);
        setDispatchStatus('🚨 Emergency SOS Email Dispatched! Monitoring email open status...');
        setIsCrashActive(false);
      } else {
        setDispatchStatus(`Dispatch status: ${res.message}`);
      }
    } catch (err: any) {
      setDispatchStatus('Error connecting to emergency backend.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Cancel False Alarm
  const handleCancelFalseAlarm = async () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setIsCrashActive(false);
    if (activeAlertId) {
      await cancelEmergencyAlert(activeAlertId);
      setActiveAlertId(null);
      setActiveAlert(null);
    }
  };

  // Simulate contact opening email
  const handleSimulateOpen = async () => {
    if (activeAlertId) {
      const res = await simulateEmailOpen(activeAlertId);
      if (res.success && res.alert) {
        setActiveAlert(res.alert);
      }
    }
  };

  // Direct phone call handler
  const handleDirectPhoneCall = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  };

  // Save Dynamic Wait Time Settings
  const [dbSaveNotice, setDbSaveNotice] = useState<string | null>(null);

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
      if (res.success) {
        if (onUpdateSettings) onUpdateSettings(validVal);
        setDbSaveNotice(`Saved to Database: ${validVal}s`);
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

  const emergencyPhone = activeAlert?.contactNotifiedPhone || authState.emergencyContacts[0]?.phone || '+91 98111 22233';

  return (
    <div className="flex-1 p-3.5 space-y-3.5 bg-slate-950 text-slate-100 relative">
      {/* 1. Header Status Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">Accident Protection Active</h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>WebSocket Sync Live</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 bg-emerald-950 border border-emerald-800/80 text-emerald-400 rounded-full">
            Escalation Window: {customWaitSeconds}s
          </span>
        </div>
      </div>

      {/* 2. REAL-TIME EMAIL OPEN TRACKER ON-SCREEN ALERTS (SYNCED VIA WEBSOCKET) */}
      {activeAlert && (
        <div className="space-y-2">
          {/* CASE A: EMAIL NOT OPENED YET AND OVER DYNAMIC WAIT TIME -> CRITICAL ALERT + CALL BUTTON */}
          {!activeAlert.emailOpened && elapsedSeconds >= customWaitSeconds && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950 via-rose-900/90 to-slate-950 border-2 border-rose-500 text-rose-100 shadow-2xl shadow-rose-950/80 animate-pulse space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                    <PhoneCall className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500 text-white shadow">
                        🚨 EMAIL NOT OPENED (OVER {customWaitSeconds}s)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-rose-300">
                        ⏱ {elapsedSeconds}s
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white mt-1">
                      Emergency Contact Has NOT Opened Email!
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => { setActiveAlertId(null); setActiveAlert(null); }}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900/80"
                  title="Dismiss alert"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-rose-200/90 leading-relaxed pl-1">
                Emergency SOS email was delivered to <strong>{activeAlert.contactNotifiedEmail}</strong>, but has not been opened in {elapsedSeconds} seconds. Please call the emergency contact directly below:
              </p>

              {/* DIRECT NATIVE PHONE CALL ACTION BUTTON */}
              <div className="pt-1">
                <a
                  href={`tel:${emergencyPhone}`}
                  onClick={(e) => {
                    handleDirectPhoneCall(emergencyPhone);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-sm shadow-xl shadow-rose-950 active:scale-[0.98] transition flex items-center justify-center gap-2.5 border border-rose-400 cursor-pointer"
                >
                  <Phone className="w-5 h-5 fill-current animate-pulse" />
                  <span>CALL EMERGENCY CONTACT NOW ({emergencyPhone})</span>
                </a>
              </div>

              {/* Simulation test helper */}
              <div className="flex items-center justify-between pt-1 border-t border-rose-800/60 text-[11px]">
                <span className="text-rose-300">Test receiver opening email:</span>
                <button
                  onClick={handleSimulateOpen}
                  className="px-2.5 py-1 rounded-lg bg-rose-800/60 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1 border border-rose-700"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Simulate Email Opened</span>
                </button>
              </div>
            </div>
          )}

          {/* CASE B: EMAIL NOT OPENED YET AND WITHIN DYNAMIC WAIT WINDOW -> AWAITING OPEN */}
          {!activeAlert.emailOpened && elapsedSeconds < customWaitSeconds && (
            <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500 text-amber-100 shadow-lg shadow-amber-950/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
                    <Mail className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                        EMAIL DISPATCHED • AWAITING OPEN
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        {Math.max(0, customWaitSeconds - elapsedSeconds)}s remaining
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mt-0.5">
                      SOS Email Sent to {activeAlert.contactNotifiedEmail}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => { setActiveAlertId(null); setActiveAlert(null); }}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-900/80"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Waiting for emergency contact to open message or tap confirmation button. If unopened in <strong>{Math.max(0, customWaitSeconds - elapsedSeconds)}s</strong>, the direct calling option will activate automatically.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSimulateOpen}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition flex items-center gap-1 shadow"
                >
                  <Eye className="w-3 h-3" />
                  <span>Simulate Contact Opening Email (Test)</span>
                </button>
              </div>
            </div>
          )}

          {/* CASE C: EMAIL IS OPENED (REAL-TIME WEBSOCKET TRIGGERED) -> INSTANT GREEN ALERT */}
          {activeAlert.emailOpened && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900/90 to-slate-950 border-2 border-emerald-400 text-emerald-100 shadow-2xl shadow-emerald-950/80 animate-fadeIn space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shrink-0 shadow-lg font-black">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-400 text-slate-950 shadow">
                      ✅ EMAIL OPENED / RESPONSE CONFIRMED!
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">
                      Recipient Opened Email at {new Date(activeAlert.emailOpenedAt || Date.now()).toLocaleTimeString()}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => { setActiveAlertId(null); setActiveAlert(null); }}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900/80"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-emerald-200/90 leading-relaxed pl-1">
                Emergency contact has opened the alert email and is viewing your live telemetry & GPS coordinates. Auto-call escalation is now safely resolved.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onAlertTriggered}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Incident Log Details</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DYNAMIC ESCALATION TIMER CONFIGURATION WIDGET */}
      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <button
            type="button"
            onClick={handleCycleWaitTime}
            className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition text-left cursor-pointer group"
            title="Click to cycle wait time & update database"
          >
            <Sliders className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="underline underline-offset-2 decoration-sky-500/50 group-hover:decoration-sky-400">Escalation Wait Time Setting:</span>
          </button>
          
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-rose-400 text-sm">{customWaitSeconds}s</span>
            {savingSettings && <span className="text-[10px] font-mono text-amber-400 animate-pulse">Syncing...</span>}
          </div>
        </div>

        {dbSaveNotice && (
          <div className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 rounded-lg flex items-center justify-between animate-fadeIn">
            <span>✅ {dbSaveNotice}</span>
            <span className="text-[9px] text-slate-400">Firebase & Local DB Synced</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {[10, 20, 30, 60].map((sec) => (
            <button
              key={sec}
              onClick={() => handleSaveWaitSeconds(sec)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${
                customWaitSeconds === sec
                  ? 'bg-rose-600 border-rose-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-400 shrink-0">Custom Seconds:</span>
          <input
            type="number"
            min="5"
            max="300"
            value={customWaitSeconds}
            onChange={(e) => setCustomWaitSeconds(Number(e.target.value))}
            onBlur={() => handleSaveWaitSeconds(customWaitSeconds)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveWaitSeconds(customWaitSeconds);
              }
            }}
            className="w-20 bg-slate-950 border border-slate-800 rounded-md px-2 py-0.5 text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500"
          />
          <button
            type="button"
            onClick={() => handleSaveWaitSeconds(customWaitSeconds)}
            className="px-2.5 py-0.5 bg-sky-950 border border-sky-800 hover:bg-sky-900 text-sky-300 text-[10px] font-bold rounded-md"
          >
            Save to DB
          </button>
        </div>

        <p className="text-[10px] text-slate-400">
          Click header or buttons to adjust. Changes are saved permanently to database and synchronized live.
        </p>
      </div>

      {/* 4. Live GPS Location & Interactive Map */}
      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <Navigation className="w-4 h-4 text-rose-500" />
            <span>Live GPS Telemetry</span>
          </div>
          <button
            onClick={fetchCurrentLocation}
            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${locLoading ? 'animate-spin' : ''}`} />
            <span>Update GPS</span>
          </button>
        </div>

        {/* Map Container */}
        <div
          ref={mapContainerRef}
          className="w-full h-32 rounded-xl bg-slate-950 border border-slate-800 relative z-0 overflow-hidden"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono bg-slate-950/80 p-2 rounded-xl border border-slate-800/60">
          <span className="truncate pr-2">{location.address}</span>
          <span className="text-rose-400 font-bold shrink-0">{location.speed?.toFixed(1) || simSpeed} km/h</span>
        </div>
      </div>

      {/* 5. Live Sensor Telemetry HUD */}
      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <Activity className="w-4 h-4 text-sky-500" />
            <span>Hardware Sensors (G-Force & Gyroscope)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">100Hz Polling</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Impact Force</span>
            <span className={`text-base font-extrabold font-mono ${sensor.totalG > (authState.settings?.gForceSensitivity || 4.5) ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
              {sensor.totalG.toFixed(2)} G
            </span>
          </div>

          <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Accel Y-Axis</span>
            <span className="text-base font-extrabold font-mono text-slate-200">
              {sensor.accelY.toFixed(1)} m/s²
            </span>
          </div>

          <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Orientation α</span>
            <span className="text-base font-extrabold font-mono text-slate-200">
              {sensor.gyroAlpha.toFixed(0)}°
            </span>
          </div>
        </div>
      </div>

      {/* 6. Crash Simulation Testing Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Crash Event & Email SOS Dispatcher</span>
          </span>
          <span className="text-[10px] text-slate-400">Hardware Simulator</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Simulate Impact Force:</span>
            <span className="font-mono font-bold text-rose-400">{simGForce.toFixed(1)} G</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="12.0"
            step="0.2"
            value={simGForce}
            onChange={(e) => setSimGForce(parseFloat(e.target.value))}
            className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-2">
          {/* Direct Instant SOS Button */}
          <button
            onClick={executeEmergencyAlertDispatch}
            disabled={isDispatching}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 font-extrabold text-xs text-white transition shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 active:scale-[0.98] border border-rose-500/50"
          >
            <Send className="w-4 h-4" />
            <span>{isDispatching ? 'Sending SOS Email...' : '⚡ Trigger Crash Detection & Send Email SOS Now'}</span>
          </button>

          {/* Countdown Simulation Button */}
          <button
            onClick={() => triggerCrashDetectionSequence(simGForce > 4.5 ? simGForce : 6.8)}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            <span>Start 10s Countdown Simulation (6.8G)</span>
          </button>
        </div>
      </div>

      {/* 7. CRASH DETECTION 10-SECOND EMERGENCY COUNTDOWN MODAL OVERLAY */}
      {isCrashActive && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg z-50 flex flex-col items-center justify-between p-6 animate-fadeIn">
          <div className="text-center space-y-1 mt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>HIGH IMPACT ACCIDENT DETECTED</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-2">
              ARE YOU OKAY?
            </h2>
            <p className="text-xs text-slate-400 max-w-xs">
              Emergency email alerts and live GPS tracking will automatically dispatch in:
            </p>
          </div>

          <div className="my-auto flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 rounded-full border-4 border-rose-600 flex items-center justify-center shadow-2xl shadow-rose-900/60 animate-pulse bg-rose-950/20">
              <span className="text-7xl font-black text-white font-mono tracking-tighter">
                {countdown}
              </span>
              <span className="absolute bottom-6 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                Seconds
              </span>
            </div>

            {dispatchStatus && (
              <p className="text-xs font-semibold text-amber-400 mt-4 text-center animate-pulse">
                {dispatchStatus}
              </p>
            )}
          </div>

          <div className="w-full space-y-2 mb-4">
            <button
              onClick={executeEmergencyAlertDispatch}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send SOS Alert Email Immediately</span>
            </button>

            <button
              onClick={handleCancelFalseAlarm}
              className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs shadow-xl shadow-emerald-950/60 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>I AM OKAY — CANCEL SOS ALERT</span>
            </button>
            <p className="text-[10px] text-center text-slate-500">
              Press cancel if this was a false alarm.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
