import React, { useState } from 'react';
import { ShieldAlert, Mail, Lock, KeyRound, User, HeartPulse, Stethoscope, ArrowRight, CheckCircle2, Phone, AlertCircle } from 'lucide-react';
import { loginUser, requestSignupOtp, updateProfile, verifyOtp, addEmergencyContact } from '../services/api';
import { AuthState, UserProfile } from '../types';

interface AuthScreensProps {
  onAuthenticated: (authState: AuthState) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ onAuthenticated }) => {
  const [screen, setScreen] = useState<'welcome' | 'login' | 'signup_credentials' | 'signup_otp' | 'signup_profile'>('welcome');

  // Form states
  const [email, setEmail] = useState('demo@rescuetron.com');
  const [password, setPassword] = useState('password123');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpNotice, setDemoOtpNotice] = useState<string | null>(null);

  // Profile Form states
  const [fullName, setFullName] = useState('Rahul Sharma');
  const [age, setAge] = useState('26');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('Penicillin, Dust');
  const [medicalConditions, setMedicalConditions] = useState('Mild Asthma');
  const [medications, setMedications] = useState('Inhaler as needed');
  const [organDonor, setOrganDonor] = useState(true);

  // Initial Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('Priya Sharma (Sister)');
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('priya.emergency@gmail.com');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('+91 98111 22233');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(email, password);
      if (res.success) {
        onAuthenticated({
          token: res.token,
          user: res.user,
          isAuthenticated: true,
          emergencyContacts: res.emergencyContacts || [],
        });
      } else {
        setError(res.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setError('Network connection error connecting to NestJS Auth server.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Credentials -> Request OTP
  const handleSignupCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await requestSignupOtp(email, password);
      if (res.success) {
        setDemoOtpNotice(res.debugOtp);
        setScreen('signup_otp');
      } else {
        setError(res.message || 'Failed to send OTP email.');
      }
    } catch (err) {
      setError('Network error requesting OTP from backend.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(email, otpCode);
      if (res.success) {
        setScreen('signup_profile');
      } else {
        setError(res.message || 'Invalid or expired OTP code.');
      }
    } catch (err) {
      setError('Error verifying OTP with backend.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Profile Creation Completion
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 1. Update user profile
      const profRes = await updateProfile({
        email,
        fullName,
        age: Number(age) || 25,
        phone,
        bloodGroup,
        allergies,
        medicalConditions,
        medications,
        organDonor,
      });

      // 2. Add primary emergency contact
      let contacts = [];
      if (emergencyContactName && emergencyContactEmail) {
        const contactRes = await addEmergencyContact({
          userId: profRes.user?.id || 'user_new',
          name: emergencyContactName,
          email: emergencyContactEmail,
          phone: emergencyContactPhone,
          relationship: 'Primary Contact',
          isPrimary: true,
        });
        contacts = contactRes.contacts || [];
      }

      const loginRes = await loginUser(email, password);

      onAuthenticated({
        token: loginRes.token || 'jwt_session_token_101',
        user: profRes.user || loginRes.user,
        isAuthenticated: true,
        emergencyContacts: contacts.length > 0 ? contacts : loginRes.emergencyContacts || [],
      });
    } catch (err) {
      setError('Error completing profile setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 relative overflow-hidden min-h-0">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* SCREEN 1: WELCOME SCREEN */}
      {screen === 'welcome' && (
        <div className="flex flex-col items-center justify-between h-full py-8 text-center animate-fadeIn">
          <div className="my-auto flex flex-col items-center">
            {/* Logo Icon */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-xl shadow-rose-950/50 mb-6 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Rescuetron<span className="text-rose-500">.ai</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
              Smart AI Accident Detection & Instant Emergency Response Platform
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Real-time Sensor Telemetry & NestJS JWT
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-3 mt-auto">
            <button
              onClick={() => setScreen('signup_credentials')}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>Create Account (Sign Up)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setScreen('login')}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 font-semibold text-sm border border-slate-800 active:scale-[0.98] transition"
            >
              Log In to Existing Account
            </button>

            <p className="text-[10px] text-slate-500 pt-2">
              Includes NestJS JWT Auth & Email OTP Integration
            </p>
          </div>
        </div>
      )}

      {/* SCREEN 2: LOGIN */}
      {screen === 'login' && (
        <div className="flex flex-col h-full py-4 animate-fadeIn">
          <button
            onClick={() => setScreen('welcome')}
            className="self-start text-xs text-slate-400 hover:text-slate-200 mb-6 flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
            <p className="text-xs text-slate-400">Log in with your registered email and password.</p>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Quick Demo Pre-fill helper */}
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Demo Account: <strong className="text-slate-200">demo@rescuetron.com</strong></span>
              <button
                type="button"
                onClick={() => {
                  setEmail('demo@rescuetron.com');
                  setPassword('password123');
                }}
                className="text-rose-400 hover:underline font-semibold"
              >
                Autofill
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 active:scale-[0.98] transition disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating NestJS JWT...' : 'Log In →'}
            </button>
          </form>
        </div>
      )}

      {/* SCREEN 3: SIGNUP STEP 1 - EMAIL & PASSWORD */}
      {screen === 'signup_credentials' && (
        <div className="flex flex-col h-full py-4 animate-fadeIn">
          <button
            onClick={() => setScreen('welcome')}
            className="self-start text-xs text-slate-400 hover:text-slate-200 mb-6 flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="mb-6">
            <span className="text-[10px] font-bold tracking-wider text-rose-500 uppercase">Step 1 of 3</span>
            <h2 className="text-2xl font-bold text-white mt-0.5 mb-1">Create Account</h2>
            <p className="text-xs text-slate-400">Enter your email address to receive an Email OTP code.</p>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignupCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                  placeholder="your.email@domain.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Create Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 active:scale-[0.98] transition disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? 'Sending Email OTP...' : 'Send OTP Verification Code →'}
            </button>
          </form>
        </div>
      )}

      {/* SCREEN 4: SIGNUP STEP 2 - OTP CODE VERIFICATION */}
      {screen === 'signup_otp' && (
        <div className="flex flex-col h-full py-4 animate-fadeIn">
          <button
            onClick={() => setScreen('signup_credentials')}
            className="self-start text-xs text-slate-400 hover:text-slate-200 mb-6 flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="mb-6">
            <span className="text-[10px] font-bold tracking-wider text-rose-500 uppercase">Step 2 of 3</span>
            <h2 className="text-2xl font-bold text-white mt-0.5 mb-1">Verify Email OTP</h2>
            <p className="text-xs text-slate-400">
              Enter the 6-digit verification code dispatched to <strong className="text-white">{email}</strong>
            </p>
          </div>

          {demoOtpNotice && (
            <div className="p-3 mb-4 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-300 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold block">Generated Email OTP Code:</span>
                <span className="text-lg font-mono tracking-widest text-white">{demoOtpNotice}</span>
              </div>
              <button
                onClick={() => setOtpCode(demoOtpNotice)}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                Auto-fill Code
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-center text-xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                  placeholder="123456"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 active:scale-[0.98] transition disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying OTP...' : 'Verify & Continue →'}
            </button>
          </form>
        </div>
      )}

      {/* SCREEN 5: SIGNUP STEP 3 - CREATE PROFILE & MEDICAL DETAILS */}
      {screen === 'signup_profile' && (
        <div className="flex-1 flex flex-col p-5 py-3 animate-fadeIn overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
          <div className="mb-3 shrink-0">
            <span className="text-[10px] font-bold tracking-wider text-rose-500 uppercase">Step 3 of 3</span>
            <h2 className="text-xl font-bold text-white mt-0.5">Create Profile & Medical Info</h2>
            <p className="text-[11px] text-slate-400">Essential details required for first responders during crash emergencies.</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-3 pb-16">
            {/* Full Name & Age */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  placeholder="Rahul Sharma"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  placeholder="26"
                />
              </div>
            </div>

            {/* Phone & Blood Group */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Your Phone No.</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Medical details */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Known Allergies</label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                placeholder="e.g. Penicillin, Peanuts (or None)"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-0.5">Pre-existing Medical Conditions</label>
              <input
                type="text"
                value={medicalConditions}
                onChange={(e) => setMedicalConditions(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                placeholder="e.g. Asthma, Diabetes (or None)"
              />
            </div>

            {/* Emergency Contact */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                <Phone className="w-3.5 h-3.5" />
                <span>Primary Emergency Contact</span>
              </div>

              <div>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600"
                  placeholder="Contact Name & Relationship"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={emergencyContactEmail}
                  onChange={(e) => setEmergencyContactEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] text-white placeholder-slate-600"
                  placeholder="Contact Email"
                />
                <input
                  type="text"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] text-white placeholder-slate-600"
                  placeholder="Contact Phone No."
                />
              </div>
            </div>

            {/* Organ donor toggle */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={organDonor}
                onChange={(e) => setOrganDonor(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span className="text-xs text-slate-300">Registered Organ Donor</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-semibold text-xs shadow-lg active:scale-[0.98] transition mt-3 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving Profile & Emergency Contact...' : 'Complete Profile & Enter App →'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
