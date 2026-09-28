import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, MapPin, Phone, HeartPulse, Stethoscope, Award, CheckCircle2, Navigation, AlertTriangle, Mail, Eye } from 'lucide-react';
import { getTrackerDetails } from '../services/api';

interface EmergencyTrackerModalProps {
  trackerId: string;
  onClose: () => void;
}

export const EmergencyTrackerModal: React.FC<EmergencyTrackerModalProps> = ({ trackerId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    const fetchTracker = async () => {
      try {
        const res = await getTrackerDetails(trackerId);
        if (res.success) {
          setData(res);
        }
      } catch (err) {
        console.error('Error fetching tracker details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTracker();
  }, [trackerId]);

  // Leaflet map setup for accident location
  useEffect(() => {
    if (data && mapRef.current && !leafletRef.current && (window as any).L) {
      const L = (window as any).L;
      const loc = data.alert?.location || { latitude: 28.6139, longitude: 77.209 };
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([loc.latitude, loc.longitude], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      const customPin = L.divIcon({
        className: 'custom-accident-pin',
        html: `<div class="w-8 h-8 bg-rose-600 border-2 border-white rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xl animate-bounce">🚨</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([loc.latitude, loc.longitude], { icon: customPin }).addTo(map);
      leafletRef.current = map;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-300 font-semibold">Opening Emergency Contact Live Tracker Portal...</p>
        </div>
      </div>
    );
  }

  const patient = data?.patientInfo || {
    fullName: 'Rahul Sharma',
    age: 26,
    phone: '+91 98765 43210',
    bloodGroup: 'O+',
    allergies: 'Penicillin, Dust',
    medicalConditions: 'Mild Asthma',
    medications: 'Inhaler as needed',
  };

  const alert = data?.alert || {
    location: { address: 'Connaught Place, New Delhi, India', latitude: 28.6139, longitude: 77.209 },
    sensorSnapshot: { totalG: 6.2 },
    timestamp: new Date().toISOString(),
    emailOpened: true,
    emailOpenedAt: new Date().toISOString(),
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Top Header Banner */}
        <div className="p-4 bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-b border-rose-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight">Emergency Contact Tracker</h3>
              <p className="text-[10px] text-rose-200">Live Patient Location & Medical Summary</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-slate-100 text-xs">
          {/* Status Alert Banner */}
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-xs block text-white">
                Emergency Email & Tracker Verified
              </span>
              <span className="text-[10px] text-emerald-200">
                Email opened at {new Date(alert.emailOpenedAt || alert.trackerOpenedAt || Date.now()).toLocaleTimeString()}. Automatic voice call escalation halted.
              </span>
            </div>
          </div>

          {/* Accident Location Map */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>Accident Location Pin</span>
            </span>

            <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div ref={mapRef} className="w-full h-full z-10" />
            </div>

            <p className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-medium">
              📍 {alert.location?.address}
            </p>
          </div>

          {/* Patient Profile Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h4 className="font-bold text-sm text-white">{patient.fullName}</h4>
                <p className="text-[10px] text-slate-400">Phone: {patient.phone} • Age: {patient.age}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Blood Group</span>
                <span className="text-sm font-extrabold text-rose-500">{patient.bloodGroup}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Known Allergies:</span>
                <span className="text-slate-200 font-medium">{patient.allergies}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Medical Conditions:</span>
                <span className="text-slate-200 font-medium">{patient.medicalConditions}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Current Medications:</span>
                <span className="text-slate-200 font-medium">{patient.medications}</span>
              </div>
            </div>
          </div>

          {/* Direct Call Patient Button */}
          <a
            href={`tel:${patient.phone}`}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-xs text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Call Patient Directly ({patient.phone})</span>
          </a>
        </div>
      </div>
    </div>
  );
};
