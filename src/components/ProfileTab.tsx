import React, { useState, useEffect } from 'react';
import { User, Shield, HeartPulse, Stethoscope, Phone, Plus, Settings, LogOut, Edit2, Check, AlertCircle, Award, Trash2, Sliders, Volume2, PhoneCall } from 'lucide-react';
import { addEmergencyContact, deleteEmergencyContact, updateProfile, saveAppSettings } from '../services/api';
import { AuthState, EmergencyContact, UserProfile } from '../types';

interface ProfileTabProps {
  authState: AuthState;
  onLogout: () => void;
  onProfileUpdated: (updatedContacts: EmergencyContact[]) => void;
  onUserUpdated?: (updatedUser: UserProfile) => void;
  onSettingsUpdated?: (newSettings: any) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  authState,
  onLogout,
  onProfileUpdated,
  onUserUpdated,
  onSettingsUpdated,
}) => {
  const user = authState.user;
  const contacts = authState.emergencyContacts;

  // Modals & Forms
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);

  // Personal Info Form
  const [uName, setUName] = useState(user?.fullName || 'Rahul Sharma');
  const [uAge, setUAge] = useState(String(user?.age || 26));
  const [uPhone, setUPhone] = useState(user?.phone || '+91 98765 43210');

  // New Contact Form
  const [cName, setCName] = useState('');
  const [cRel, setCRel] = useState('Family');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPrimary, setCPrimary] = useState(false);

  // Editable Medical Details
  const [mBlood, setMBlood] = useState(user?.bloodGroup || 'O+');
  const [mAllergies, setMAllergies] = useState(user?.allergies || 'Penicillin, Dust');
  const [mConditions, setMConditions] = useState(user?.medicalConditions || 'Mild Asthma');
  const [mMedications, setMMedications] = useState(user?.medications || 'Inhaler as needed');

  // Dynamic Settings
  const [trackerWaitSecs, setTrackerWaitSecs] = useState(authState.settings?.trackerWaitSeconds || 20);
  const [gForceSens, setGForceSens] = useState(authState.settings?.gForceSensitivity || 4.5);
  const [autoCalling, setAutoCalling] = useState(authState.settings?.autoCallingEnabled ?? true);
  const [sirenSound, setSirenSound] = useState(authState.settings?.soundAlertsEnabled ?? true);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUName(user.fullName || '');
      setUAge(String(user.age || 25));
      setUPhone(user.phone || '');
      setMBlood(user.bloodGroup || 'O+');
      setMAllergies(user.allergies || 'None');
      setMConditions(user.medicalConditions || 'None');
      setMMedications(user.medications || 'None');
    }
  }, [user]);

  useEffect(() => {
    if (authState.settings) {
      if (authState.settings.trackerWaitSeconds) setTrackerWaitSecs(authState.settings.trackerWaitSeconds);
      if (authState.settings.gForceSensitivity) setGForceSens(authState.settings.gForceSensitivity);
      if (authState.settings.autoCallingEnabled !== undefined) setAutoCalling(authState.settings.autoCallingEnabled);
      if (authState.settings.soundAlertsEnabled !== undefined) setSirenSound(authState.settings.soundAlertsEnabled);
    }
  }, [authState.settings]);

  // Handle Save Personal Details
  const handleSavePersonal = async () => {
    setLoading(true);
    try {
      const res = await updateProfile({
        email: user?.email,
        fullName: uName,
        age: Number(uAge) || 25,
        phone: uPhone,
      });
      if (res.success && res.user) {
        if (onUserUpdated) onUserUpdated(res.user);
        setIsEditingPersonal(false);
        setStatusMsg('Personal details saved to database.');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error updating personal details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Contact
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await addEmergencyContact({
        userId: user?.id || 'demo_user',
        name: cName,
        relationship: cRel,
        phone: cPhone,
        email: cEmail,
        isPrimary: cPrimary,
      });

      if (res.success) {
        onProfileUpdated(res.contacts || []);
        setIsAddingContact(false);
        setCName('');
        setCPhone('');
        setCEmail('');
        setStatusMsg('Emergency contact added and saved to database.');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error adding contact:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Contact
  const handleDeleteContact = async (contactId: string) => {
    try {
      const res = await deleteEmergencyContact(contactId, user?.id || 'demo_user');
      if (res.success) {
        onProfileUpdated(res.contacts || []);
        setStatusMsg('Contact removed from database.');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  // Handle Update Medical Details
  const handleSaveMedical = async () => {
    setLoading(true);
    try {
      const res = await updateProfile({
        email: user?.email,
        bloodGroup: mBlood,
        allergies: mAllergies,
        medicalConditions: mConditions,
        medications: mMedications,
      });
      if (res.success && res.user) {
        if (onUserUpdated) onUserUpdated(res.user);
        setIsEditingMedical(false);
        setStatusMsg('Medical profile saved to database.');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error updating medical profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettingsConfig = async (newWait?: number, newG?: number, newAutoCall?: boolean, newSound?: boolean) => {
    const updatedWait = newWait !== undefined ? newWait : trackerWaitSecs;
    const updatedG = newG !== undefined ? newG : gForceSens;
    const updatedAutoCall = newAutoCall !== undefined ? newAutoCall : autoCalling;
    const updatedSound = newSound !== undefined ? newSound : sirenSound;

    if (newWait !== undefined) setTrackerWaitSecs(newWait);
    if (newG !== undefined) setGForceSens(newG);
    if (newAutoCall !== undefined) setAutoCalling(newAutoCall);
    if (newSound !== undefined) setSirenSound(newSound);

    try {
      const res = await saveAppSettings({
        userId: user?.id,
        email: user?.email,
        trackerWaitSeconds: updatedWait,
        gForceSensitivity: updatedG,
        autoCallingEnabled: updatedAutoCall,
        soundAlertsEnabled: updatedSound,
      });
      if (res.success) {
        if (onSettingsUpdated) onSettingsUpdated(res.settings);
        setStatusMsg('System settings updated & saved to backend.');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  };

  return (
    <div className="flex-1 p-3.5 space-y-3.5 bg-slate-950 text-slate-100 overflow-y-auto">
      {statusMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 1. User Header & Avatar Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shrink-0 shadow-lg shadow-rose-950/40">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl font-bold text-white">
                {user?.fullName ? user.fullName.charAt(0) : 'R'}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{user?.fullName || 'Rahul Sharma'}</h2>
              <p className="text-xs text-slate-400 truncate">{user?.email || 'demo@rescuetron.com'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 font-bold text-[10px] rounded-md">
                  Blood: {mBlood}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Age: {user?.age || 26}</span>
                <span className="text-[10px] text-amber-400 font-mono">{user?.phone || '+91 98765 43210'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditingPersonal(!isEditingPersonal)}
            className="text-[11px] text-rose-400 hover:underline font-semibold flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditingPersonal ? 'Cancel' : 'Edit'}</span>
          </button>
        </div>

        {/* Personal Details Edit Form */}
        {isEditingPersonal && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs animate-fadeIn">
            <h4 className="font-bold text-rose-400 text-xs">Edit Personal Profile</h4>
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Full Name</label>
              <input
                type="text"
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Age</label>
                <input
                  type="number"
                  value={uAge}
                  onChange={(e) => setUAge(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Phone Number</label>
                <input
                  type="text"
                  value={uPhone}
                  onChange={(e) => setUPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs"
                />
              </div>
            </div>
            <button
              onClick={handleSavePersonal}
              disabled={loading}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs transition"
            >
              {loading ? 'Saving...' : 'Save Personal Details'}
            </button>
          </div>
        )}
      </div>

      {/* 2. Medical Emergency Info Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-slate-200">Medical Emergency Details</span>
          </div>

          <button
            onClick={() => setIsEditingMedical(!isEditingMedical)}
            className="text-[11px] text-rose-400 hover:underline font-semibold flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditingMedical ? 'Cancel' : 'Edit'}</span>
          </button>
        </div>

        {!isEditingMedical ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">Allergies</span>
              <span className="text-slate-200 font-medium">{mAllergies || 'None'}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">Pre-existing Conditions</span>
              <span className="text-slate-200 font-medium">{mConditions || 'None'}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">Medications</span>
              <span className="text-slate-200 font-medium">{mMedications || 'None'}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 block">Organ Donor Status</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Award className="w-3 h-3" />
                <span>Verified Donor</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-1 text-xs">
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Blood Group</label>
              <select
                value={mBlood}
                onChange={(e) => setMBlood(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              >
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Known Allergies</label>
              <input
                type="text"
                value={mAllergies}
                onChange={(e) => setMAllergies(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Pre-existing Conditions</label>
              <input
                type="text"
                value={mConditions}
                onChange={(e) => setMConditions(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Medications</label>
              <input
                type="text"
                value={mMedications}
                onChange={(e) => setMMedications(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <button
              onClick={handleSaveMedical}
              disabled={loading}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs transition"
            >
              {loading ? 'Saving...' : 'Save Medical Info'}
            </button>
          </div>
        )}
      </div>

      {/* 3. Emergency Contacts Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Emergency Contacts</span>
          </div>

          <button
            onClick={() => setIsAddingContact(!isAddingContact)}
            className="p-1 px-2.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 text-[11px] font-semibold border border-rose-800/60 transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>

        {/* Contacts List */}
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-100">{contact.name}</span>
                  {contact.isPrimary && (
                    <span className="text-[9px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-400 px-1.5 py-0.2 rounded">
                      PRIMARY
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">{contact.relationship} • {contact.email}</p>
                <p className="text-[10px] text-amber-400 font-mono">{contact.phone}</p>
              </div>

              <button
                onClick={() => handleDeleteContact(contact.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                title="Remove Contact"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Contact Form */}
        {isAddingContact && (
          <form onSubmit={handleAddContactSubmit} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs mt-2">
            <h4 className="font-semibold text-rose-400 text-xs">New Emergency Contact</h4>
            <input
              type="text"
              placeholder="Full Name"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Relationship (e.g. Sister)"
                value={cRel}
                onChange={(e) => setCRel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
              />
              <input
                type="text"
                placeholder="Phone No."
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
            />
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={cPrimary}
                onChange={(e) => setCPrimary(e.target.checked)}
                className="rounded border-slate-800 bg-slate-900 text-rose-600"
              />
              <span className="text-[11px] text-slate-300">Set as Primary Emergency Contact</span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs"
            >
              {loading ? 'Saving...' : 'Add Emergency Contact'}
            </button>
          </form>
        )}
      </div>

      {/* 4. Dynamic Escalation & Accident Detection Settings */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-slate-200">Dynamic Response & Escalation Settings</span>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Dynamic Email Open Wait Time */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const presets = [10, 20, 30, 60];
                  const idx = presets.indexOf(trackerWaitSecs);
                  const next = idx >= 0 && idx < presets.length - 1 ? presets[idx + 1] : presets[0];
                  handleSaveSettingsConfig(next);
                }}
                className="text-slate-300 hover:text-sky-300 font-semibold cursor-pointer underline underline-offset-2 decoration-sky-500/50"
                title="Click to cycle wait window & save to database"
              >
                Email Open Escalation Wait Window:
              </button>
              <span className="font-mono font-bold text-rose-400">{trackerWaitSecs}s</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[10, 20, 30, 60].map((sec) => (
                <button
                  key={sec}
                  onClick={() => handleSaveSettingsConfig(sec)}
                  className={`py-1 rounded-lg text-[11px] font-bold transition border ${
                    trackerWaitSecs === sec
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block">
              Time to wait for email open before activating phone calling. Click label or buttons to update database.
            </span>
          </div>

          {/* G-Force Impact Sensitivity */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-slate-300 block font-semibold">Impact Force Sensitivity</span>
              <span className="text-[10px] text-slate-500">Threshold: {gForceSens}G</span>
            </div>
            <select
              value={gForceSens}
              onChange={(e) => handleSaveSettingsConfig(undefined, parseFloat(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-1.5 text-[11px]"
            >
              <option value="3.5">3.5G (High)</option>
              <option value="4.5">4.5G (Balanced)</option>
              <option value="6.0">6.0G (Severe Only)</option>
              <option value="8.0">8.0G (Extreme)</option>
            </select>
          </div>

          {/* Auto Calling Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-slate-300 block font-semibold">Auto-Calling Escalation</span>
              <span className="text-[10px] text-slate-500">Prompt phone call if email not opened</span>
            </div>
            <button
              onClick={() => handleSaveSettingsConfig(undefined, undefined, !autoCalling)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition border ${
                autoCalling
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {autoCalling ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Firebase Realtime Database Live Synchronization Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span className="text-xs font-bold text-amber-300">Firebase Realtime DB Sync</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Connected to <code className="text-amber-300 font-mono text-[10px]">rescuetron-f1edc-default-rtdb.firebaseio.com</code>. All users, contacts, and settings automatically synchronize.
        </p>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch('/api/firebase/sync-all', { method: 'POST' });
              const data = await res.json();
              if (data.success) {
                setStatusMsg('✅ All database records pushed to Firebase Realtime Database!');
                setTimeout(() => setStatusMsg(null), 3500);
              }
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="w-full py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/50 text-xs font-bold transition flex items-center justify-center gap-2 active:scale-98"
        >
          <span>{loading ? 'Syncing...' : '⚡ Force Push All Data to Firebase Now'}</span>
        </button>
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-rose-400 font-semibold text-xs active:scale-98 transition flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of Rescuetron</span>
      </button>
    </div>
  );
};
