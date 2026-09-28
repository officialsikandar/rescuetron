export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  age: number;
  bloodGroup: string;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  isOrganDonor?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  timestamp: string;
  status: 'PENDING' | 'DISPATCHED' | 'EMAIL_OPENED' | 'TRACKER_OPENED' | 'CALL_ESCALATED' | 'CANCELLED';
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  sensorSnapshot: {
    totalG: number;
    speedKmh: number;
  };
  trackerId: string;
  trackerUrl: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  emailOpenCount?: number;
  contactNotifiedEmail?: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  emergencyContacts: EmergencyContact[];
}
