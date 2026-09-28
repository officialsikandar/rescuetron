export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  age: number;
  phone: string;
  bloodGroup: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  organDonor: boolean;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  address?: string;
  timestamp: string;
}

export interface SensorData {
  accelX: number;
  accelY: number;
  accelZ: number;
  totalG: number;
  gyroAlpha: number;
  gyroBeta: number;
  gyroGamma: number;
  impactDetected: boolean;
  timestamp: string;
}

export type AlertStatus =
  | 'COUNTDOWN'
  | 'ALERT_SENT'
  | 'EMAIL_OPENED'
  | 'TRACKER_OPENED'
  | 'ESCALATED_CALL'
  | 'CANCELLED_BY_USER';

export interface AlertRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  location: LocationData;
  sensorSnapshot: SensorData;
  status: AlertStatus;
  trackerId: string;
  trackerUrl?: string;
  contactNotifiedEmail: string;
  contactNotifiedPhone: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  emailOpenCount?: number;
  trackerOpenedAt?: string;
  autoCallTriggeredAt?: string;
  escalationTimerSeconds: number;
}

export interface AppSettings {
  trackerWaitSeconds: number;
  gForceSensitivity: number;
  autoCallingEnabled: boolean;
  soundAlertsEnabled: boolean;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  emergencyContacts: EmergencyContact[];
  settings?: AppSettings;
}

export interface NestCodeFile {
  path: string;
  title: string;
  description: string;
  language: string;
  code: string;
}
