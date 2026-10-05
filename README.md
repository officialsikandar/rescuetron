# ⚡ Rescuetron — Accident Detection & Real-Time Emergency Response System

Rescuetron is a complete IoT, mobile, and web-based accident detection and emergency dispatch platform.

## 📖 Full Feature Catalog & Architecture Documentation
For complete technical details, API documentation, and architecture diagrams, see:
👉 **[`SYSTEM_FEATURES_AND_ARCHITECTURE.md`](./SYSTEM_FEATURES_AND_ARCHITECTURE.md)**

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
npm start
```

---

## 🛠️ Main Tech Stack
- **Web App**: React 19, TypeScript, Tailwind CSS v4, Leaflet Maps
- **Mobile Client**: React Native / Expo, Location & Motion Sensors
- **Server**: Express.js, TypeScript, WebSockets (`/ws`)
- **Database**: Firebase Realtime DB + Local JSON persistence fallback (`/data/rescuetron_db.json`)
- **Email Delivery**: Brevo HTTPS API, Resend HTTPS API, Brevo SMTP & Gmail Relay
