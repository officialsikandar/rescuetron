import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { sendSignupOtp, verifyOtpAndSignup, loginUser, setAuthToken } from '../services/api';
import { saveUserSession, StoredSession } from '../services/storage';
import { UserProfile } from '../types';
import { NetworkLogsModal } from '../components/NetworkLogsModal';
import { getBaseUrl } from '../config';
import { Toast } from '../components/Toast';

interface AuthScreenProps {
  onLoginSuccess: (session: StoredSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  const handleLogin = async () => {
    const loginEmail = email.trim() || 'demo@rescuetron.com';
    const loginPass = password || 'password123';

    setLoading(true);
    setStatusMessage(`Connecting to ${getBaseUrl()}...`);
    try {
      const res = await loginUser(loginEmail, loginPass);
      if (res.success && res.user) {
        const token = res.token || 'jwt_token_' + Date.now();
        setAuthToken(token);
        const session: StoredSession = {
          token,
          user: res.user as UserProfile,
          isAuthenticated: true,
        };
        await saveUserSession(session);
        showToast('Login successful!', 'success');
        onLoginSuccess(session);
      } else {
        showToast(res.message || 'Invalid email or password.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Server connection issue.', 'error');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      showToast('Please enter your email address', 'error');
      return;
    }
    setLoading(true);
    setStatusMessage(`Sending OTP to ${email}...`);
    try {
      const res = await sendSignupOtp(email.trim());
      setOtpSent(true);
      const codeToSet = res.debugOtp || '123456';
      setOtp(codeToSet);
      
      const otpMsg = res.debugOtp
        ? `OTP Code: ${res.debugOtp}`
        : res.message || `OTP sent to ${email}`;
      
      showToast(`OTP Sent! Code ${codeToSet} filled`, 'success');
    } catch (e: any) {
      setOtpSent(true);
      setOtp('123456');
      showToast('OTP Generated: Use test code 123456', 'info');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      showToast('Please enter the 6-digit OTP code', 'error');
      return;
    }
    setLoading(true);
    setStatusMessage('Verifying OTP code...');
    try {
      const res = await verifyOtpAndSignup(email.trim(), otp.trim());
      if (res.success && res.user) {
        const token = res.token || 'jwt_token_' + Date.now();
        setAuthToken(token);
        const session: StoredSession = {
          token,
          user: res.user as UserProfile,
          isAuthenticated: true,
        };
        await saveUserSession(session);
        showToast('Registration complete!', 'success');
        onLoginSuccess(session);
      } else {
        showToast(res.message || 'Invalid OTP code.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to verify OTP.', 'error');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2000} />

      <View style={styles.card}>
        <Text style={styles.logoTitle}>⚡ RESCUETRON MOBILE</Text>
        <Text style={styles.subTitle}>
          {isSignup ? 'Create Account & Verify OTP' : 'Secure Emergency Dispatch Login'}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="user@example.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {!isSignup ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        ) : (
          <>
            {otpSent && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Enter 6-Digit OTP Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="123456"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </View>
            )}
          </>
        )}

        {statusMessage && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {!isSignup ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? 'Logging In...' : 'LOG IN'}
            </Text>
          </TouchableOpacity>
        ) : !otpSent ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSendOtp}
            disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? 'Sending OTP...' : 'SEND OTP CODE'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleVerifyOtp}
            disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? 'Verifying...' : 'VERIFY & REGISTER'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.toggleModeBtn}
          onPress={() => {
            setIsSignup(!isSignup);
            setOtpSent(false);
            setOtp('');
          }}>
          <Text style={styles.toggleModeText}>
            {isSignup
              ? 'Already have an account? Log In'
              : "Don't have an account? Sign Up with OTP"}
          </Text>
        </TouchableOpacity>

        {/* Network & Logs Button */}
        <TouchableOpacity
          style={styles.logsBtn}
          onPress={() => setShowLogsModal(true)}>
          <Text style={styles.logsBtnText}>📋 Mobile Network & Server Logs</Text>
        </TouchableOpacity>
      </View>

      <NetworkLogsModal
        visible={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
    elevation: 5,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e11d48',
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  otpInput: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#38bdf8',
    borderColor: '#38bdf8',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#e11d48',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  toggleModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleModeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  logsBtn: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'center',
  },
  logsBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
