import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { getLogs, subscribeLogs, clearLogs, LogEntry } from '../services/logger';
import { getBaseUrl, setCustomApiUrl, SHARED_SERVER_URL } from '../config';

interface NetworkLogsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NetworkLogsModal: React.FC<NetworkLogsModalProps> = ({
  visible,
  onClose,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverUrlInput, setServerUrlInput] = useState(getBaseUrl());
  const [editingServer, setEditingServer] = useState(false);

  useEffect(() => {
    setLogs(getLogs());
    const unsubscribe = subscribeLogs((updated) => setLogs(updated));
    return unsubscribe;
  }, []);

  const handleSaveServerUrl = (urlToSet?: string) => {
    const target = urlToSet || serverUrlInput;
    if (!target) return;
    setCustomApiUrl(target);
    setServerUrlInput(target);
    Alert.alert('Server API URL Updated', `API requests will now be sent to:\n${getBaseUrl()}`);
    setEditingServer(false);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'API_REQ':
        return '#38bdf8';
      case 'API_RES':
        return '#34d399';
      case 'API_ERR':
        return '#f43f5e';
      case 'EMAIL_OTP':
        return '#fbbf24';
      default:
        return '#94a3b8';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📋 Mobile Network & API Logs</Text>
              <Text style={styles.subTitle}>Live Traffic Console & Diagnostics</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Current API Base URL Box */}
          <View style={styles.serverBox}>
            <Text style={styles.serverLabel}>Active Backend API Endpoint:</Text>
            {!editingServer ? (
              <View style={styles.serverRow}>
                <Text style={styles.serverUrlText} numberOfLines={1}>
                  {getBaseUrl()}
                </Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setServerUrlInput(getBaseUrl());
                    setEditingServer(true);
                  }}>
                  <Text style={styles.editBtnText}>✏️ Change URL</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrlInput}
                  onChangeText={setServerUrlInput}
                  placeholder="e.g. https://ais-pre-*.run.app/api"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveServerUrl()}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.resetCloudBtn}
              onPress={() => handleSaveServerUrl(SHARED_SERVER_URL)}>
              <Text style={styles.resetCloudBtnText}>
                🌐 Connect to Public Server ({SHARED_SERVER_URL.split('/')[2].substring(0, 20)}...)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <Text style={styles.countText}>{logs.length} Log Entries Recorded</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={clearLogs}>
              <Text style={styles.clearBtnText}>🗑️ Clear Logs</Text>
            </TouchableOpacity>
          </View>

          {/* Logs List */}
          <ScrollView style={styles.logList} contentContainerStyle={styles.logListContent}>
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No network logs recorded yet.</Text>
                <Text style={styles.emptySubText}>
                  Send an OTP or log in to see real-time HTTP requests & responses here.
                </Text>
              </View>
            ) : (
              logs.map((item) => (
                <View key={item.id} style={styles.logCard}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.badge, { color: getLogColor(item.type), borderColor: getLogColor(item.type) }]}>
                      [{item.type}]
                    </Text>
                    <Text style={styles.timestamp}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                  {item.details ? (
                    <Text style={styles.detailsJson}>
                      {typeof item.details === 'object'
                        ? JSON.stringify(item.details, null, 2)
                        : String(item.details)}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '85%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
  },
  title: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subTitle: {
    color: '#64748b',
    fontSize: 11,
  },
  closeBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  serverBox: {
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  serverLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serverUrlText: {
    color: '#34d399',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  editBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  editContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  serverInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#f8fafc',
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: 'bold',
  },
  resetCloudBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: '#34d399',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  resetCloudBtnText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countText: {
    color: '#64748b',
    fontSize: 11,
  },
  clearBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearBtnText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logList: {
    flex: 1,
  },
  logListContent: {
    paddingBottom: 20,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySubText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  timestamp: {
    color: '#475569',
    fontSize: 10,
  },
  message: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '500',
  },
  detailsJson: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#090d16',
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
  },
});
