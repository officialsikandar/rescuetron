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
  Linking,
} from 'react-native';
import { EmergencyContact } from '../types';
import { saveEmergencyContact, fetchEmergencyContacts, deleteEmergencyContact } from '../services/api';
import { Toast } from '../components/Toast';

interface ContactsScreenProps {
  userId: string;
}

export const ContactsScreen: React.FC<ContactsScreenProps> = ({ userId }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    {
      id: 'c1',
      name: 'Sarah Connor',
      relationship: 'Spouse / Primary',
      phone: '+1 555-0199',
      email: 'sarah.connor@rescuetron.com',
      isPrimary: true,
    },
    {
      id: 'c2',
      name: 'Dr. Michael Vance',
      relationship: 'Family Doctor',
      phone: '+1 555-0842',
      email: 'dr.vance@rescuetron.com',
      isPrimary: false,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [userId]);

  const loadContacts = async () => {
    try {
      const fetched = await fetchEmergencyContacts(userId);
      if (fetched && fetched.length > 0) {
        setContacts(fetched);
      }
    } catch (e) {
      console.log('Using default contacts');
    }
  };

  const handleEditClick = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setRelationship(contact.relationship || '');
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setIsPrimary(Boolean(contact.isPrimary));
    setShowForm(true);
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      setLoading(true);
      await deleteEmergencyContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      setLoading(false);
      showToast('Contact deleted successfully', 'success');
    } catch (e) {
      setLoading(false);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      showToast('Contact removed', 'info');
    }
  };

  const handleSaveContact = async () => {
    if (!name || !phone) {
      showToast('Please enter Name and Phone Number', 'error');
      return;
    }

    setLoading(true);
    try {
      const contactData = {
        id: editingId || undefined,
        userId,
        name,
        relationship: relationship || 'Emergency Contact',
        phone,
        email: email || 'contact@rescuetron.com',
        isPrimary,
      };

      const result = await saveEmergencyContact(contactData);
      setLoading(false);

      if (result.success || result.contacts) {
        showToast(editingId ? 'Contact updated!' : 'Contact saved & synced!', 'success');
        if (result.contacts) {
          setContacts(result.contacts);
        } else {
          if (editingId) {
            setContacts((prev) =>
              prev.map((c) => (c.id === editingId ? { ...c, ...contactData } as EmergencyContact : c))
            );
          } else {
            setContacts((prev) => [
              ...prev,
              { ...contactData, id: result.contact?.id || `c_${Date.now()}` } as EmergencyContact,
            ]);
          }
        }
        setShowForm(false);
        resetForm();
      } else {
        showToast(result.message || 'Failed to save contact', 'error');
      }
    } catch (e) {
      setLoading(false);
      showToast('Contact saved locally', 'info');
      if (editingId) {
        setContacts((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, name, relationship, phone, email, isPrimary } : c))
        );
      } else {
        setContacts((prev) => [
          ...prev,
          {
            id: `c_${Date.now()}`,
            name,
            relationship: relationship || 'Contact',
            phone,
            email,
            isPrimary,
          },
        ]);
      }
      setShowForm(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRelationship('');
    setPhone('');
    setEmail('');
    setIsPrimary(false);
  };

  const makeCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const sendSMS = (phoneNumber: string) => {
    Linking.openURL(`sms:${phoneNumber}?body=Emergency! I am sending an alert via Rescuetron.`);
  };

  return (
    <View style={styles.container}>
      <Toast message={toastMsg} type={toastType} onHide={() => setToastMsg(null)} duration={2000} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          When an accident is detected, Rescuetron will instantly dispatch SMS, Email, and GPS tracking links to these contacts.
        </Text>

        {/* Contacts List */}
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View style={styles.nameBlock}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelation}>{contact.relationship}</Text>
              </View>
              {contact.isPrimary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>PRIMARY SOS</Text>
                </View>
              )}
            </View>

            <Text style={styles.contactDetail}>📞 {contact.phone}</Text>
            <Text style={styles.contactDetail}>✉️ {contact.email}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnCall}
                onPress={() => makeCall(contact.phone)}>
                <Text style={styles.actionBtnText}>Call SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSms}
                onPress={() => sendSMS(contact.phone)}>
                <Text style={styles.actionBtnText}>SMS Alert</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnEdit}
                onPress={() => handleEditClick(contact)}>
                <Text style={styles.actionBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnDelete}
                onPress={() => handleDeleteContact(contact.id)}>
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add Contact Form Toggle */}
        {!showForm ? (
          <TouchableOpacity
            style={styles.addToggleBtn}
            onPress={() => {
              resetForm();
              setShowForm(true);
            }}>
            <Text style={styles.addToggleBtnText}>+ Add Emergency Contact</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? 'Edit Emergency Contact' : 'Add New Emergency Contact'}
            </Text>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Jane Doe"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g. Parent / Spouse / Friend"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. +1 555-0199"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Email Address (For Live Tracker Email Alert)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="e.g. notify@example.com"
              placeholderTextColor="#64748b"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Set as Primary SOS Contact</Text>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                trackColor={{ false: '#334155', true: '#e11d48' }}
                thumbColor={isPrimary ? '#f43f5e' : '#94a3b8'}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveContact}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingId ? 'Update Contact' : 'Save Contact'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 18 },
  contactCard: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameBlock: { flex: 1, marginRight: 8 },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  contactRelation: { fontSize: 12, color: '#38bdf8', marginTop: 2 },
  primaryBadge: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e11d48',
  },
  primaryBadgeText: { color: '#f43f5e', fontSize: 10, fontWeight: 'bold' },
  contactDetail: { color: '#cbd5e1', fontSize: 13, marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'center',
  },
  actionBtnCall: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnSms: {
    flex: 2,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnEdit: {
    flex: 1.5,
    backgroundColor: '#0f766e',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnDelete: {
    width: 36,
    height: 32,
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderWidth: 1,
    borderColor: '#e11d48',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 11 },
  addToggleBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addToggleBtnText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  formCard: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginTop: 8,
  },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  switchLabel: { color: '#ffffff', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#ffffff', fontWeight: 'bold' },
  submitBtn: {
    flex: 1,
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: { color: '#ffffff', fontWeight: 'bold' },
});
