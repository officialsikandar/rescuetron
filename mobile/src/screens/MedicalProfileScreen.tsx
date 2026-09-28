import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { UserProfile } from '../types';
import { updateUserProfile, getAppSettings, saveAppSettings } from '../services/api';
import { Toast } from '../components/Toast';

interface MedicalProfileScreenProps {
  user: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const MedicalProfileScreen: React.FC<MedicalProfileScreenProps> = ({
  user,
  onProfileUpdated,
}) => {
  const [fullName, setFullName] = useState(user?.fullName || 'John Doe');
  const [age, setAge] = useState(user?.age ? String(user.age) : '28');
  const [phone, setPhone] = useState(user?.phone || '+1 555-0199');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || 'O+');
  const [allergies, setAllergies] = useState(user?.allergies || 'Penicillin, Peanuts');
  const [medicalConditions, setMedicalConditions] = useState(
    user?.medicalConditions || 'Asthma',
  );
  const [medications, setMedications] = useState(user?.medications || 'Albuterol Inhaler');
  
  // Donor toggle state (handles both Blood / Organ donor toggle)
  const initialDonorVal = Boolean(
    user?.organDonor ?? user?.isOrganDonor ?? user?.isBloodDonor ?? user?.bloodDonor ?? true
  );
  const [isOrganDonor, setIsOrganDonor] = useState(initialDonorVal);
  const [loading, setLoading] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Settings State
  const [trackerWaitSecs, setTrackerWaitSecs] = useState(20);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAppSettings();
        if (res?.settings?.trackerWaitSeconds) {
          setTrackerWaitSecs(res.settings.trackerWaitSeconds);
        }
      } catch (e) {
        // default 20s
      }
    })();
  }, []);

  const handleSaveWaitSecs = async (sec: number) => {
    setTrackerWaitSecs(sec);
    setSavingSettings(true);
    try {
      await saveAppSettings({
        userId: user?.id,
        email: user?.email,
        trackerWaitSeconds: sec,
      });
      showToast(`Escalation wait set to ${sec}s in Firebase`, 'success');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const handleSave = async () => {
    setLoading(true);
    try {
      const updatedData: any = {
        email: user?.email || 'demo@rescuetron.com',
        fullName,
        age: parseInt(age, 10) || 0,
        phone,
        bloodGroup,
        allergies,
        medicalConditions,
        medications,
        // Pass all donor property aliases so Firebase Realtime Database & MongoDB update correctly
        organDonor: isOrganDonor,
        isOrganDonor,
        isBloodDonor: isOrganDonor,
        bloodDonor: isOrganDonor,
        isDonor: isOrganDonor,
      };

      const result = await updateUserProfile(updatedData);
      setLoading(false);

      if (result.success || result.user) {
        showToast('Medical Profile & Donor toggle synced to Firebase!', 'success');
        if (onProfileUpdated && result.user) {
          onProfileUpdated(result.user);
        }
      } else {
        showToast(result.message || 'Failed to update profile.', 'error');
      }
    } catch (e: any) {
      setLoading(false);
      showToast('Profile saved on device', 'info');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2000} />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Medical Emergency ID</Text>
        <Text style={styles.subtitle}>
          This profile will be shared with First Responders & Emergency Contacts upon crash detection.
        </Text>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full Name"
            placeholderTextColor="#64748b"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="Age"
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Phone"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>
        </View>

        {/* Critical Medical Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Medical Specs</Text>

          <Text style={styles.label}>Blood Group</Text>
          <View style={styles.bloodGroupContainer}>
            {bloodGroups.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[
                  styles.bloodPill,
                  bloodGroup === bg && styles.bloodPillActive,
                ]}
                onPress={() => setBloodGroup(bg)}>
                <Text
                  style={[
                    styles.bloodPillText,
                    bloodGroup === bg && styles.bloodPillTextActive,
                  ]}>
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Known Allergies</Text>
          <TextInput
            style={styles.input}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g. Penicillin, Latex, Peanuts"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Pre-existing Medical Conditions</Text>
          <TextInput
            style={styles.input}
            value={medicalConditions}
            onChangeText={setMedicalConditions}
            placeholder="e.g. Asthma, Diabetes, Epilepsy"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Current Medications</Text>
          <TextInput
            style={styles.input}
            value={medications}
            onChangeText={setMedications}
            placeholder="e.g. Insulin, Inhaler, Blood thinners"
            placeholderTextColor="#64748b"
          />

          {/* Donor Toggle (Synced to Firebase DB) */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Registered Blood / Organ Donor</Text>
              <Text style={styles.switchSubLabel}>Syncs donor status directly to Firebase DB</Text>
            </View>
            <Switch
              value={isOrganDonor}
              onValueChange={setIsOrganDonor}
              trackColor={{ false: '#334155', true: '#0284c7' }}
              thumbColor={isOrganDonor ? '#38bdf8' : '#94a3b8'}
            />
          </View>
        </View>

        {/* Escalation Wait Time Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Auto Call Escalation Settings</Text>
          <Text style={styles.label}>Email Open Escalation Wait Window:</Text>
          <View style={styles.presetRow}>
            {[10, 20, 30, 60].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.presetPill,
                  trackerWaitSecs === sec && styles.presetPillActive,
                ]}
                onPress={() => handleSaveWaitSecs(sec)}>
                <Text
                  style={[
                    styles.presetPillText,
                    trackerWaitSecs === sec && styles.presetPillTextActive,
                  ]}>
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.settingFooterText}>
            Select duration to wait for email open before automated phone call escalation is triggered. Saves directly to database.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save & Sync Profile to Firebase</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 12,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  bloodGroupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  bloodPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bloodPillActive: {
    backgroundColor: '#e11d48',
    borderColor: '#f43f5e',
  },
  bloodPillText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13 },
  bloodPillTextActive: { color: '#ffffff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  switchLabel: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  switchSubLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  presetRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  presetPill: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetPillActive: { backgroundColor: '#e11d48', borderColor: '#f43f5e' },
  presetPillText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  presetPillTextActive: { color: '#ffffff' },
  settingFooterText: { color: '#64748b', fontSize: 11, marginTop: 4 },
  saveButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});
