# Rescuetron NestJS Backend API

Production-grade NestJS REST API server for Rescuetron Accident Detection System.

## Architecture & Features
- **Authentication**: JWT Strategy (`@nestjs/jwt` & `passport-jwt`) with 6-Digit Email OTP verification.
- **Firebase Firestore Integration**: Uses `firebase-admin` for storing User Profiles, Medical Data, Emergency Contacts, and Live Emergency Alerts.
- **Emergency Telephony & Mail Escalation**: Auto-dispatches emergency alerts with unique tracker URLs, triggers status updates when tracker link is opened, and manages automated call escalation logic.

## Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

## Setup & Running

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start NestJS in Development mode (with Hot Reloading on port 3000)
npm run start:dev
```

## API Endpoints

### Auth Module (`/api/auth`)
- `POST /api/auth/send-otp` - Send 6-digit verification code to email
- `POST /api/auth/verify-otp` - Verify code & create user JWT token
- `POST /api/auth/login` - Login with email & password
- `POST /api/auth/profile` - Update user medical details & profile
- `POST /api/auth/contacts` - Add emergency contact

### Emergency Module (`/api/emergency`)
- `POST /api/emergency/dispatch` - Trigger crash accident alert & generate live tracker link
- `GET /api/emergency/history/:userId` - Fetch user's emergency dispatch logs
- `GET /api/emergency/tracker/:trackerId` - Public tracker endpoint opened by emergency contact
- `POST /api/emergency/cancel/:alertId` - Cancel false alarm
