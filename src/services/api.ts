import { AlertRecord, EmergencyContact, UserProfile } from '../types';

const API_BASE = '/api';

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: `Server returned unexpected response (HTTP ${res.status})`,
      alerts: [],
      contacts: [],
    };
  }
}

export async function requestSignupOtp(email: string, pass: string) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  return parseJsonResponse(res);
}

export async function verifyOtp(email: string, otp: string) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  return parseJsonResponse(res);
}

export async function loginUser(email: string, pass: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  return parseJsonResponse(res);
}

export async function updateProfile(profileData: Partial<UserProfile>) {
  const res = await fetch(`${API_BASE}/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });
  return parseJsonResponse(res);
}

export async function addEmergencyContact(contact: Partial<EmergencyContact> & { userId: string }) {
  const res = await fetch(`${API_BASE}/user/emergency-contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact),
  });
  return parseJsonResponse(res);
}

export async function getEmergencyContacts(userId: string) {
  const res = await fetch(`${API_BASE}/user/emergency-contacts/${userId}`);
  return parseJsonResponse(res);
}

export async function updateLocation(payload: {
  userId: string;
  latitude: number;
  longitude: number;
  address?: string;
  speed?: number | null;
}) {
  const res = await fetch(`${API_BASE}/location/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function triggerEmergencyAlert(payload: {
  userId: string;
  userEmail: string;
  userName: string;
  location: any;
  sensorSnapshot: any;
  contactEmail: string;
  contactPhone: string;
}) {
  const res = await fetch(`${API_BASE}/alert/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function getTrackerDetails(trackerId: string) {
  const res = await fetch(`${API_BASE}/tracker/${trackerId}`);
  return parseJsonResponse(res);
}

export async function cancelEmergencyAlert(alertId: string) {
  const res = await fetch(`${API_BASE}/alert/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId }),
  });
  return parseJsonResponse(res);
}

export async function triggerAutoCallEscalation(alertId: string) {
  const res = await fetch(`${API_BASE}/alert/escalate-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId }),
  });
  return parseJsonResponse(res);
}

export async function getAlertHistory(userId: string): Promise<{ success: boolean; alerts: AlertRecord[] }> {
  const res = await fetch(`${API_BASE}/alert/history/${encodeURIComponent(userId)}`);
  return parseJsonResponse(res);
}

export async function getAlertStatus(alertId: string): Promise<{ success: boolean; alert: AlertRecord }> {
  const res = await fetch(`${API_BASE}/alert/status/${encodeURIComponent(alertId)}`);
  return parseJsonResponse(res);
}

export async function simulateEmailOpen(alertId?: string): Promise<{ success: boolean; message: string; alert: AlertRecord }> {
  const res = await fetch(`${API_BASE}/alert/simulate-open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId }),
  });
  return parseJsonResponse(res);
}

export async function getSmtpStatus() {
  const res = await fetch(`${API_BASE}/email/status`);
  return parseJsonResponse(res);
}

export async function getAppSettings() {
  const res = await fetch(`${API_BASE}/user/settings`);
  return parseJsonResponse(res);
}

export async function saveAppSettings(settings: Partial<{
  userId: string;
  email: string;
  trackerWaitSeconds: number;
  gForceSensitivity: number;
  autoCallingEnabled: boolean;
  soundAlertsEnabled: boolean;
}>) {
  const res = await fetch(`${API_BASE}/user/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return parseJsonResponse(res);
}

export async function deleteEmergencyContact(contactId: string, userId: string) {
  const res = await fetch(`${API_BASE}/user/emergency-contacts/${contactId}?userId=${userId}`, {
    method: 'DELETE',
  });
  return parseJsonResponse(res);
}

export async function getUserProfile(emailOrId: string) {
  const res = await fetch(`${API_BASE}/user/profile/${encodeURIComponent(emailOrId)}`);
  return parseJsonResponse(res);
}

export async function sendTestEmail(targetEmail?: string) {
  const res = await fetch(`${API_BASE}/email/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetEmail }),
  });
  return parseJsonResponse(res);
}

export async function forceFirebaseSync() {
  const res = await fetch(`${API_BASE}/firebase/sync-all`, {
    method: 'POST',
  });
  return parseJsonResponse(res);
}
