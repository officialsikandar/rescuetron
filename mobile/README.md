# Rescuetron Mobile App (React Native / Expo)

Emergency Accident Detection & Rapid Response Mobile Application built with React Native and Expo.

## Features
- **Accelerometer Impact Sensor**: Uses `expo-sensors` Accelerometer to calculate G-force vector magnitude ($G = \sqrt{x^2+y^2+z^2} / 9.81$). Triggers 10-second warning countdown on impact $>4.5G$.
- **Live GPS Tracker**: Uses `expo-location` to fetch latitude/longitude and send reverse-geocoded alerts to emergency contacts.
- **Email OTP Authentication**: Secure login & signup flow using NestJS JWT API.
- **Medical Profile & Contacts**: Stores blood group, allergies, conditions, and emergency contacts.
- **Alert History & Tracker Link**: View active alerts and monitor live emergency status.

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Expo Go app on your iOS / Android physical phone, OR Android Studio / Xcode Emulator.

### 2. Configuration
Open `src/config.ts` and set your NestJS backend URL:
- For **Android Emulator**: `http://10.0.2.2:3000/api`
- For **iOS Simulator**: `http://localhost:3000/api`
- For **Physical Phone**: `http://YOUR_LOCAL_IP:3000/api` (e.g., `http://192.168.1.100:3000/api`)

### 3. Installation
```bash
cd mobile
npm install
```

### 4. Run Mobile App
```bash
# Start Expo development server
npm start

# Or run directly on Android emulator
npm run android

# Or run directly on iOS simulator (macOS)
npm run ios
```
