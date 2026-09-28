import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { sendSignupOtp, verifyOtpAndSignup, loginUser, setAuthToken } from '../services/api';
import { saveUserSession, StoredSession } from '../services/storage';
import { UserProfile } from '../types';
import { NetworkLogsModal } from '../components/NetworkLogsModal';
import { getBaseUrl } from '../config';

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
        onLoginSuccess(session);
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid email or password.');
      }
    } catch (e: any) {
      Alert.alert('Login Error', e.message || 'Server connection issue. Check server IP in logs.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email.');
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
        : res.message || `An OTP was sent to ${email}`;
      
      Alert.alert('OTP Status', `${otpMsg}\n\nCode ${codeToSet} filled automatically.`);
    } catch (e: any) {
      setOtpSent(true);
      setOtp('123456');
      Alert.alert('OTP Generated', 'Use test OTP code: 123456');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the 6-digit OTP code.');
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
        onLoginSuccess(session);
      } else {
        Alert.alert('Verification Failed', res.message || 'Invalid OTP code.');
      }
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to verify OTP.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoTitle: {
    color: '#f43f5e',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subTitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  otpInput: {
    borderColor: '#f43f5e',
    color: '#f43f5e',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 12,
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
    letterSpacing: 1,
  },
  toggleModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleModeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  logsBtn: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logsBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
});
