# ⚡ RESCUETRON — Full System Architecture, Features & Technical Specification

> **Accident Detection, Crash Telemetry & Automated Real-Time Emergency Response Network**

---

## 📌 1. Project Overview & Objective

**Rescuetron** is a full-stack, mission-critical IoT & mobile emergency response system designed to detect vehicle crashes, motorcycle accidents, and high G-force impacts in real time. Upon impact detection, it initiates an automated life-saving escalation pipeline:
1. **Accident Detection**: Continuously samples device accelerometer ($G_x, G_y, G_z$) and gyroscope ($\alpha, \beta, \gamma$) sensors.
2. **False Alarm Grace Period**: Sounds a local siren and triggers a 10-second countdown allowing the user to cancel in case of a false alarm.
3. **Multi-Channel Emergency Dispatch**: Automatically dispatches rich emergency alert emails to all configured emergency contacts with patient medical ID, real-time GPS coordinates, and IST timestamps.
4. **Live GPS Tracker & Medical ID Portal**: Provides first responders and family members with an interactive map, medical summary, and live status.
5. **Email Open Detection & Auto-Escalation**: Uses tracking pixels and confirmation buttons to monitor contact response; if unacknowledged, triggers secondary automated emergency call escalation.

---

## 🏗️ 2. System Architecture & Tech Stack

```
                               ┌──────────────────────────────────────────────┐
                               │             USER CLIENTS                     │
                               │  - Mobile App (React Native / Expo)          │
                               │  - Web SPA Dashboard (React 19 + Vite)       │
                               │  - Emergency Tracker Portal (Web / Mobile)   │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTPS / WSS
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           RESCUETRON BACKEND SERVER          │
                               │  - Node.js + Express (server.ts)             │
                               │  - Real-Time WebSocket Hub (/ws)             │
                               │  - Multi-Gateway Email Engine                │
                               └──────────┬────────────────────┬──────────────┘
                                          │                    │
                   ┌──────────────────────▼──────┐      ┌──────▼───────────────────────┐
                   │    PERSISTENT DATABASE      │      │    EMAIL DELIVERY GATEWAYS   │
                   │  - Firebase Realtime DB     │      │  - Brevo REST API / SMTP     │
                   │  - Local DB JSON Fallback   │      │  - Resend HTTPS Gateway      │
                   │  - MongoDB Schema Ready     │      │  - Gmail App Password Relay  │
                   └─────────────────────────────┘      └──────────────────────────────┘
```

### Technology Breakdown:
- **Frontend Web**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Leaflet Maps, Framer Motion.
- **Mobile Client**: React Native / Expo, Expo Sensors (Accelerometer, Gyroscope), Expo Location.
- **Backend**: Express.js, TypeScript (`tsx`), WebSocket (`ws`), Node.js DNS IPv4-first resolution.
- **Data Layer**: Dual Firebase Realtime Database + JSON persistence store (`/data/rescuetron_db.json`).
- **Communication Hub**: WebSocket (`/ws`) for instant sub-second event broadcasts.

---

## 🚀 3. Complete Feature Catalog (Implemented Till Date)

### 3.1 Accident Detection & Crash Telemetry
- **Dynamic G-Force Thresholding**: Calculates resultant total G force $\sqrt{G_x^2 + G_y^2 + G_z^2}$. Triggers alert if total force exceeds configurable sensitivity threshold (default $4.5\text{ G}$).
- **Pre & Post Crash Verification**: Validates high deceleration combined with gyro angular displacement to prevent false positives from everyday bumps.
- **Interactive Simulation Controls**: Web and mobile UI provide instant crash simulation presets (Minor Bump $2.1\text{G}$, High-Speed Crash $7.4\text{G}$, Rollover $5.8\text{G}$).
- **False Alarm Grace Period**: 10-second countdown with visual flashing strobe, audible siren sound, and a prominent "Cancel False Alarm" button.

### 3.2 Dynamic Emergency Contacts System
- **Per-User Contact Storage**: Every user has isolated emergency contacts stored under their user ID.
- **Primary Contact Designation**: Allows setting any contact as `isPrimary: true`. When marked primary, other contacts for that user automatically switch to secondary.
- **Multi-Contact Broadcast**: Alerts are dispatched simultaneously to the primary contact AND all configured secondary contacts.
- **Relationship & Phone Linking**: Stores contact name, relationship (Spouse, Sister, Doctor, Family), phone number, and email. Provides one-tap direct dialing (`tel:` URI).

### 3.3 Multi-Gateway Email Dispatch Engine
- **Brevo REST API v3 Gateway**: Dispatches via `https://api.brevo.com/v3/smtp/email` supporting unlimited recipient domains.
- **Brevo SMTP Gateway**: Dispatches over `smtp-relay.brevo.com:587` with IPv4-first DNS binding.
- **Resend HTTPS Gateway**: Dispatches via `https://api.resend.com/emails` with structured HTML emails.
- **Gmail Fallback Relay**: Nodemailer transporter on port 465 with sanitized app credentials.
- **Fast Failover & Short Timeouts**: 3.5s timeout prevents blocking user actions if a mail server is unreachable.

### 3.4 Rich Emergency Email Design & Tracking
- **Urgent Visual Styling**: High-contrast dark red emergency header with high priority flag (`priority: high`).
- **Patient Medical Profile Card**: Includes victim name, age, phone number, blood group, known allergies, chronic conditions, current medications, and organ donor status.
- **Telemetry Snapshot**: G-Force at impact, speed in km/h, exact timestamp in Indian Standard Time (IST).
- **One-Tap Confirm Button**: "✅ I HAVE RECEIVED THIS ALERT (CONFIRM RESPONSE)" updates the incident status to `EMAIL_OPENED` in real time.
- **Open Tracking Pixel**: 1x1 invisible PNG beacon (`/api/email/track-open/:id.png`) with a 4-second initial grace window to ignore automated antivirus mail scanners.

### 3.5 Live GPS Tracker & Medical ID Portal
- **Zero-Login Emergency URL**: Public link `/?tracker=trk_...` accessible immediately by emergency responders and family without login hurdles.
- **Live Leaflet GPS Map**: Visualizes exact crash latitude/longitude coordinates with high-precision marker and radius.
- **Live Status Badge**: Displays real-time state (`ALERT_SENT`, `EMAIL_OPENED`, `TRACKER_OPENED`, `ESCALATED_CALL`, `CANCELLED_BY_USER`).
- **Responder Medical Summary**: Blood type, allergies, medications, and organ donor badge prominently displayed.

### 3.6 Automated Countdown Escalation
- **Custom Escalation Timers**: Configurable timer (e.g. 20s, 30s, 60s) set by the user.
- **Auto-Call Escalation**: If no contact acknowledges the alert before the countdown reaches zero, status automatically advances to `ESCALATED_CALL` and notifies all listening clients.

### 3.7 Authentication & User Management
- **6-Digit Email OTP Verification**: Instant verification code sent to the user's email for registration and passwordless login.
- **Editable Medical Profile**: Real-time updates for blood group, allergies, medications, conditions, and organ donor status.
- **Multi-Device Session Management**: Synchronizes settings across mobile and web clients via JWT tokens and WebSocket.

---

## 📡 4. Backend API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register email and dispatch 6-digit OTP |
| `POST` | `/api/auth/send-otp` | Request login OTP code |
| `POST` | `/api/auth/verify-otp` | Verify OTP code and issue session token |
| `GET` | `/api/user/profile/:id` | Fetch full user profile, contacts, and settings |
| `POST` | `/api/user/profile` | Update personal and medical profile details |
| `GET` | `/api/user/emergency-contacts/:userId` | Get list of emergency contacts for user |
| `POST` | `/api/user/emergency-contacts` | Create or update emergency contact |
| `DELETE` | `/api/user/emergency-contacts/:id` | Delete emergency contact |
| `GET` | `/api/user/settings` | Get escalation wait time and sensitivity settings |
| `POST` | `/api/user/settings` | Update settings in database |
| `POST` | `/api/location/update` | Post live GPS telemetry update |
| `POST` | `/api/alert/trigger` | Trigger emergency crash alert & dispatch emails |
| `GET` | `/api/alert/status/:id` | Get status of a specific alert |
| `GET` | `/api/alert/history/:userId` | Get incident history for logged-in user |
| `DELETE` | `/api/alert/:id` | Delete incident from history |
| `DELETE` | `/api/alert/history/clear/:userId` | Clear all alert history for user |
| `GET` | `/api/tracker/:trackerId` | Public live tracker portal endpoint |
| `GET` | `/api/email/track-open/:id.png` | Web beacon tracking pixel |
| `GET` | `/api/email/confirm-open/:id` | Direct button confirmation link |
| `GET` | `/api/email/status` | Diagnostic email gateway health check |
| `GET` | `/api/test-resend` | Diagnostic email test trigger |
| `WS` | `/ws` | Real-time WebSocket connection |

---

## 💾 5. Database Schema Structure

```json
{
  "settings": {
    "trackerWaitSeconds": 20,
    "gForceSensitivity": 4.5,
    "autoCallingEnabled": true,
    "soundAlertsEnabled": true,
    "lastUpdated": "2026-09-30T04:00:00.000Z"
  },
  "users": {
    "user_id": {
      "id": "user_1790525210329",
      "email": "demo@yopmail.com",
      "fullName": "SIKANDAR KHAN",
      "phone": "+918005913597",
      "age": 26,
      "bloodGroup": "O+",
      "allergies": "Penicillin, Dust",
      "medicalConditions": "Mild Asthma",
      "medications": "Inhaler as needed",
      "organDonor": true,
      "lastLocation": {
        "latitude": 26.99135,
        "longitude": 75.74334,
        "address": "26.991350, 75.743340",
        "speed": 48,
        "timestamp": "2026-09-30T04:16:35.072Z"
      }
    }
  },
  "contacts": {
    "contact_id": {
      "id": "contact_1790741788267",
      "userId": "user_1790525210329",
      "name": "Priya Sharma",
      "relationship": "Sister",
      "phone": "+91 98111 22233",
      "email": "khansonu8538@gmail.com",
      "isPrimary": true,
      "createdAt": "2026-09-30T04:16:28.267Z",
      "updatedAt": "2026-09-30T04:16:28.267Z"
    }
  },
  "alerts": {
    "alert_id": {
      "id": "alert_1790741795072",
      "userId": "user_1790525210329",
      "userEmail": "demo@yopmail.com",
      "userName": "SIKANDAR KHAN",
      "status": "ALERT_SENT",
      "trackerId": "trk_qb78kdkx",
      "contactNotifiedEmail": "khansonu8538@gmail.com",
      "contactNotifiedPhone": "+91 98111 22233",
      "contactPhones": ["+91 98111 22233", "08005913597"],
      "emailOpened": false,
      "emailOpenCount": 0,
      "escalationTimerSeconds": 30,
      "location": {
        "latitude": 26.99135,
        "longitude": 75.74334,
        "address": "26.991350, 75.743340",
        "speed": 48,
        "timestamp": "2026-09-30T04:16:35.072Z"
      },
      "sensorSnapshot": {
        "totalG": 5.4,
        "accelX": 1.2,
        "accelY": 5.1,
        "accelZ": 8.9,
        "impactDetected": true,
        "timestamp": "2026-09-30T04:16:35.072Z"
      },
      "victimProfile": {
        "fullName": "SIKANDAR KHAN",
        "age": 26,
        "phone": "+918005913597",
        "email": "demo@yopmail.com",
        "bloodGroup": "O+",
        "allergies": "Penicillin, Dust",
        "medicalConditions": "Mild Asthma",
        "medications": "Inhaler as needed",
        "organDonor": true
      }
    }
  }
}
```

---

## 🔒 6. Key Rules & Fail-Safe Guidelines (Never Forget)
1. **No Silent Fallback to Fixed Email**: Always dispatch to the logged-in user's configured emergency contact (`contact.email`). Never hardcode or substitute `sikandaritguy@gmail.com` unless that email was explicitly entered by the user.
2. **Fast Mail Gateway Fallback**: If an SMTP server or REST endpoint encounters network delay, fail over within $\le 3.5\text{s}$ to preserve application responsiveness.
3. **Real-Time Data Priority**: Always read and persist updated contact, profile, location, and alert records directly to the database.
4. **Preserve Public Tracker Access**: The emergency tracker URL (`/?tracker=trk_...`) must remain publicly accessible without requiring credentials so first responders can immediately view critical medical data.
