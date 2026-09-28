import { UserProfile } from '../types';

export interface StoredSession {
  token: string;
  user: UserProfile;
  isAuthenticated: boolean;
}

const SESSION_KEY = 'RESCUETRON_MOBILE_AUTH_SESSION_V1';

let AsyncStorageModule: any = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorageModule = null;
}

export const saveUserSession = async (session: StoredSession): Promise<boolean> => {
  try {
    const jsonValue = JSON.stringify(session);
    if (AsyncStorageModule && AsyncStorageModule.setItem) {
      await AsyncStorageModule.setItem(SESSION_KEY, jsonValue);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_KEY, jsonValue);
    }
    return true;
  } catch (e) {
    console.error('Error saving session:', e);
    return false;
  }
};

export const getUserSession = async (): Promise<StoredSession | null> => {
  try {
    let jsonValue: string | null = null;
    if (AsyncStorageModule && AsyncStorageModule.getItem) {
      jsonValue = await AsyncStorageModule.getItem(SESSION_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      jsonValue = window.localStorage.getItem(SESSION_KEY);
    }
    if (jsonValue) {
      return JSON.parse(jsonValue) as StoredSession;
    }
    return null;
  } catch (e) {
    console.error('Error getting session:', e);
    return null;
  }
};

export const clearUserSession = async (): Promise<boolean> => {
  try {
    if (AsyncStorageModule && AsyncStorageModule.removeItem) {
      await AsyncStorageModule.removeItem(SESSION_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SESSION_KEY);
    }
    return true;
  } catch (e) {
    console.error('Error clearing session:', e);
    return false;
  }
};
