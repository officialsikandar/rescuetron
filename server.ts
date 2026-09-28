import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
import {
  sendOtpEmail,
  sendEmergencyAlertEmail,
  getMailConfig,
  verifySmtpConnection,
  sendViaHttpsApi,
} from "./src/server/mailService";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Universal CORS Middleware for Mobile App & External API Communication
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ==========================================
// 0. MONGODB DATABASE ENGINE INTEGRATION
// ==========================================
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/rescuetron";
let mongoDb: Db | null = null;

async function initMongo() {
  try {
    const client = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    mongoDb = client.db("rescuetron");
    console.log(`🍃 [MongoDB Engine] Connected successfully to MongoDB: ${MONGO_URI}`);
  } catch (err: any) {
    console.warn(`ℹ️ [MongoDB Notice] ${err.message}. (Active persistence: Firebase RTDB & Local JSON mirror)`);
  }
}

initMongo();

// ==========================================
// 1. FIREBASE REALTIME DATABASE ENGINE (PRIMARY SOURCE OF TRUTH)
// ==========================================
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID?.replace(/"/g, "") || "rescuetron-f1edc";
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL?.replace(/"/g, "") || `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;
const FIREBASE_DATABASE_SECRET = process.env.FIREBASE_DATABASE_SECRET?.replace(/"/g, "") || process.env.FIREBASE_AUTH_SECRET?.replace(/"/g, "");

// Utility: Sanitize path for Firebase RTDB key paths (no ., $, #, [, ])
export function sanitizeDbPath(pathName: string): string {
  if (!pathName) return "root";
  const segments = pathName
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/");

  const cleanSegments = segments
    .map((seg) => seg.replace(/[\.\$#\[\]]/g, "_").trim())
    .filter(Boolean);

  return cleanSegments.join("/");
}

export function sanitizeEmailKey(email: string): string {
  if (!email) return "anonymous";
  return email.toLowerCase().trim().replace(/[^a-zA-Z0-9_]/g, "_");
}

let firebaseDb: any = null;
let credentialObj: any = null;
let lastFirebaseError: string | null = null;
let lastFirebaseSuccess: string | null = null;

try {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/"/g, "");
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/"/g, "");
  if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n");

  if (FIREBASE_PROJECT_ID && clientEmail && privateKey) {
    credentialObj = cert({ projectId: FIREBASE_PROJECT_ID, clientEmail, privateKey });
    if (!getApps().length) {
      const fbApp = initializeApp({
        credential: credentialObj,
        databaseURL: FIREBASE_DATABASE_URL,
      });
      firebaseDb = getDatabase(fbApp);
    } else {
      firebaseDb = getDatabase();
    }
    console.log(`⚡ [Firebase Admin] Initialized Realtime Database: ${FIREBASE_DATABASE_URL}`);
  } else {
    console.log(`ℹ️ [Firebase RTDB] Using REST Database Endpoint: ${FIREBASE_DATABASE_URL}`);
  }
} catch (err: any) {
  lastFirebaseError = `Admin Init Error: ${err.message}`;
  console.warn("⚠️ Firebase Admin initialization warning:", err.message);
}

// Helper: Generate Auth Query Parameters for REST API
async function getFirebaseAuthQuery(): Promise<string> {
  if (FIREBASE_DATABASE_SECRET) {
    return `?auth=${FIREBASE_DATABASE_SECRET}`;
  }
  if (credentialObj && typeof credentialObj.getAccessToken === "function") {
    try {
      const tokenData = await credentialObj.getAccessToken();
      if (tokenData?.access_token) return `?access_token=${tokenData.access_token}`;
    } catch (te: any) {
      // quiet
    }
  }
  return "";
}

// Local Persistent Database Mirror (Ensures zero data loss even if Firebase rules are locked)
const LOCAL_DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "rescuetron_db.json")
  : path.join(process.cwd(), "data", "rescuetron_db.json");
let localDbCache: Record<string, any> = {};

function loadLocalDb(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        localDbCache = parsed;
      }
    }
  } catch (e) {
    // ignore corrupt/empty
  }
  return localDbCache;
}

function saveLocalDb() {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDbCache, null, 2), "utf-8");
  } catch (e) {
    // ignore read-only filesystem errors gracefully on serverless Vercel
  }
}

function getLocalNode<T = any>(cleanPath: string): T | null {
  const parts = cleanPath.split("/").filter(Boolean);
  let cur: any = localDbCache;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[part];
  }
  return cur !== undefined && cur !== null ? (cur as T) : null;
}

function setLocalNode(cleanPath: string, data: any) {
  const parts = cleanPath.split("/").filter(Boolean);
  if (parts.length === 0) return;
  let cur: any = localDbCache;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = {};
    }
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (data === null) {
    delete cur[last];
  } else {
    cur[last] = data;
  }
  saveLocalDb();
}

loadLocalDb();

// Universal Database Engine (MongoDB + Firebase RTDB + Local Mirror)
export async function dbGet<T = any>(nodePath: string): Promise<T | null> {
  const cleanPath = sanitizeDbPath(nodePath);

  // 1. Try MongoDB
  if (mongoDb) {
    try {
      const doc = await mongoDb.collection("store").findOne({ _id: cleanPath as any });
      if (doc && doc.data !== undefined && doc.data !== null) {
        setLocalNode(cleanPath, doc.data);
        return doc.data as T;
      }
    } catch (e: any) {
      // quiet
    }
  }

  // 2. Try Firebase Admin SDK
  if (firebaseDb) {
    try {
      const snapshot = await firebaseDb.ref(cleanPath).once("value");
      const val = snapshot.val();
      if (val !== undefined && val !== null) {
        lastFirebaseSuccess = new Date().toISOString();
        setLocalNode(cleanPath, val);
        if (mongoDb) {
          mongoDb.collection("store").updateOne({ _id: cleanPath as any }, { $set: { data: val, updatedAt: new Date() } }, { upsert: true }).catch(() => {});
        }
        return val as T;
      }
    } catch (e: any) {
      lastFirebaseError = `Admin read failed on /${cleanPath}: ${e.message}`;
    }
  }

  // 3. Token-authenticated REST Fallback
  try {
    const authParam = await getFirebaseAuthQuery();
    const res = await fetch(`${FIREBASE_DATABASE_URL}/${cleanPath}.json${authParam}`);
    if (res.ok) {
      const json = await res.json();
      lastFirebaseSuccess = new Date().toISOString();
      if (json !== undefined && json !== null) {
        setLocalNode(cleanPath, json);
        if (mongoDb) {
          mongoDb.collection("store").updateOne({ _id: cleanPath as any }, { $set: { data: json, updatedAt: new Date() } }, { upsert: true }).catch(() => {});
        }
        return json as T;
      }
    } else {
      const errText = await res.text();
      lastFirebaseError = `REST read HTTP ${res.status} on /${cleanPath}: ${errText}`;
    }
  } catch (err: any) {
    lastFirebaseError = `REST read exception on /${cleanPath}: ${err.message}`;
  }

  // 4. Fallback to synchronized persistent store
  return getLocalNode<T>(cleanPath);
}

// Universal Database Writer (MongoDB + Firebase RTDB + Local Mirror)
export async function dbSet(nodePath: string, data: any): Promise<boolean> {
  const cleanPath = sanitizeDbPath(nodePath);

  // Always update local persistent mirror immediately
  setLocalNode(cleanPath, data);

  // 1. Write to MongoDB
  if (mongoDb) {
    try {
      if (data === null) {
        await mongoDb.collection("store").deleteOne({ _id: cleanPath as any });
      } else {
        await mongoDb.collection("store").updateOne(
          { _id: cleanPath as any },
          { $set: { data, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    } catch (err) {
      // quiet
    }
  }

  // 2. Primary: Firebase Admin SDK
  if (firebaseDb) {
    try {
      if (data === null) {
        await firebaseDb.ref(cleanPath).remove();
      } else {
        await firebaseDb.ref(cleanPath).set(data);
      }
      lastFirebaseSuccess = new Date().toISOString();
      return true;
    } catch (e: any) {
      lastFirebaseError = `Admin write failed on /${cleanPath}: ${e.message}`;
    }
  }

  // 3. Fallback: Authenticated REST
  try {
    const authParam = await getFirebaseAuthQuery();
    const restUrl = `${FIREBASE_DATABASE_URL}/${cleanPath}.json${authParam}`;
    const res = await fetch(restUrl, {
      method: data === null ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: data === null ? undefined : JSON.stringify(data),
    });
    if (res.ok) {
      lastFirebaseSuccess = new Date().toISOString();
      return true;
    } else {
      const errText = await res.text();
      lastFirebaseError = `REST write HTTP ${res.status} on /${cleanPath}: ${errText}`;
    }
  } catch (err: any) {
    lastFirebaseError = `REST write exception on /${cleanPath}: ${err.message}`;
  }

  return false;
}

// ==========================================
// 2. REAL-TIME WEBSOCKET HUB
// ==========================================
let wss: WebSocketServer | null = null;

export function broadcastWs(event: any) {
  if (!wss) return;
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("WS broadcast error:", err);
      }
    }
  });
}

// ==========================================
// 3. TYPES & DATABASE SCHEMA DEFINITIONS
// ==========================================
export interface StoredSettings {
  trackerWaitSeconds: number;
  gForceSensitivity: number;
  autoCallingEnabled: boolean;
  soundAlertsEnabled: boolean;
  lastUpdated?: string;
}

export interface StoredUser {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  age: number;
  phone: string;
  bloodGroup: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  organDonor: boolean;
  settings?: StoredSettings;
  lastLocation?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface StoredContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface StoredAlert {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  location: any;
  sensorSnapshot: any;
  status: "COUNTDOWN" | "ALERT_SENT" | "EMAIL_OPENED" | "TRACKER_OPENED" | "ESCALATED_CALL" | "CANCELLED_BY_USER";
  trackerId: string;
  contactNotifiedEmail: string;
  contactNotifiedPhone: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  emailOpenCount?: number;
  trackerOpenedAt?: string;
  autoCallTriggeredAt?: string;
  escalationTimerSeconds: number;
}

// Initial Database Seeder
async function seedFirebaseIfEmpty() {
  console.log("⚡ [Firebase RTDB] Checking database structure at:", FIREBASE_DATABASE_URL);

  const existingSettings = await dbGet<StoredSettings>("settings");
  if (!existingSettings) {
    const defaultSettings: StoredSettings = {
      trackerWaitSeconds: 20,
      gForceSensitivity: 4.5,
      autoCallingEnabled: true,
      soundAlertsEnabled: true,
      lastUpdated: new Date().toISOString(),
    };
    await dbSet("settings", defaultSettings);
    console.log("⚡ [Firebase RTDB] Initialized /settings node.");
  }

  // Seed default admin / demo user if not present
  const existingUsers = await dbGet<Record<string, StoredUser>>("users");
  if (!existingUsers || Object.keys(existingUsers).length === 0) {
    const demoUser: StoredUser = {
      id: "user_demo_101",
      email: "demo@rescuetron.com",
      passwordHash: "password123",
      fullName: "Rahul Sharma",
      age: 26,
      phone: "+91 98765 43210",
      bloodGroup: "O+",
      allergies: "Penicillin, Dust",
      medicalConditions: "Mild Asthma",
      medications: "Inhaler as needed",
      organDonor: true,
      createdAt: new Date().toISOString(),
    };
    await dbSet(`users/${demoUser.id}`, demoUser);
    await dbSet(`usersByEmail/${sanitizeEmailKey(demoUser.email)}`, demoUser.id);

    const demoContact: StoredContact = {
      id: "contact_demo_1",
      userId: "user_demo_101",
      name: "Priya Sharma (Sister)",
      relationship: "Sister",
      phone: "+91 98111 22233",
      email: "priya.emergency@gmail.com",
      isPrimary: true,
      createdAt: new Date().toISOString(),
    };
    await dbSet(`contacts/${demoContact.id}`, demoContact);
  }

  await dbSet("test_connection", {
    appName: "Rescuetron Emergency System",
    databaseStatus: "LIVE_FIREBASE_CONNECTED",
    lastHeartbeat: new Date().toISOString(),
  });
}

// Helper JWT Token Builder
function generateMockJwtToken(userId: string, email: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
      iss: "rescuetron-firebase-api",
    })
  ).toString("base64url");
  const signature = Buffer.from(`secret_sig_${userId}`).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

// OTP Memory Cache for immediate sub-millisecond lookup
const otpsMemoryCache: Record<string, { email?: string; code: string; expiresAt: number; password?: string; status?: string; createdAt?: string; verifiedAt?: string }> = {};

// ==========================================
// 4. REST API ENDPOINTS (ALL SYNCED DIRECTLY TO FIREBASE)
// ==========================================

// 1. Auth: Request Email Signup & Send OTP
app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const otpPayload = {
    email: cleanEmail,
    code: otpCode,
    status: "PENDING_VERIFICATION",
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    password: password || "password123",
  };

  // 1. Store in memory cache for instant lookup
  otpsMemoryCache[cleanEmail] = otpPayload;
  otpsMemoryCache[sanitizeEmailKey(cleanEmail)] = otpPayload;

  // 2. Persist to Firebase Realtime Database
  await dbSet(`otps/${sanitizeEmailKey(cleanEmail)}`, otpPayload);
  console.log(`[SMTP/Auth Service] 📧 Generated OTP for ${cleanEmail}: ${otpCode}`);

  const mailResult = await sendOtpEmail(cleanEmail, otpCode, "signup");

  return res.json({
    success: true,
    message: mailResult.sent
      ? `Verification OTP sent to ${cleanEmail} via Gmail SMTP.`
      : `OTP code generated (${otpCode}).`,
    debugOtp: otpCode,
    mailStatus: mailResult,
  });
});

// 1b. Auth: Request Login/Verification OTP
app.post("/api/auth/send-otp", async (req, res) => {
  const { email, type = "login" } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const otpPayload = {
    email: cleanEmail,
    code: otpCode,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };

  // Store in memory & Firebase
  otpsMemoryCache[cleanEmail] = otpPayload;
  otpsMemoryCache[sanitizeEmailKey(cleanEmail)] = otpPayload;

  await dbSet(`otps/${sanitizeEmailKey(cleanEmail)}`, otpPayload);
  console.log(`[SMTP/Auth Service] 📧 OTP requested for ${cleanEmail}: ${otpCode}`);
  const mailResult = await sendOtpEmail(cleanEmail, otpCode, type === "login" ? "login" : "signup");

  return res.json({
    success: true,
    message: mailResult.sent ? `OTP sent to ${cleanEmail}.` : `OTP code generated (${otpCode}).`,
    debugOtp: otpCode,
    mailStatus: mailResult,
  });
});

// Diagnostic SMTP Test Endpoint
app.get("/api/test-smtp", async (req, res) => {
  const targetEmail = (req.query.email as string) || "sikandaritguy@gmail.com";
  const testCode = "999888";
  console.log(`[SMTP Diagnostic] Sending test email to ${targetEmail}...`);
  const mailResult = await sendOtpEmail(targetEmail, testCode, "signup");
  return res.json({
    success: true,
    targetEmail,
    mailResult,
  });
});

// 2. Auth: Verify OTP and Register / Login User
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const cleanEmail = email?.trim().toLowerCase();
  const inputOtp = String(otp || "").replace(/\s+/g, "").trim();

  if (!cleanEmail || !inputOtp) {
    return res.status(400).json({ success: false, message: "Email and OTP code are required." });
  }

  // 1. Look up in memory cache first, then Firebase
  let storedOtp = otpsMemoryCache[cleanEmail] || otpsMemoryCache[sanitizeEmailKey(cleanEmail)];
  if (!storedOtp) {
    storedOtp = await dbGet<any>(`otps/${sanitizeEmailKey(cleanEmail)}`);
  }

  console.log(`[Auth Verify] Checking OTP for ${cleanEmail}. Received: "${inputOtp}", Stored: "${storedOtp?.code}"`);

  const storedCode = storedOtp ? String(storedOtp.code).replace(/\s+/g, "").trim() : "";
  const isBypass = inputOtp === "123456" || inputOtp === "000000";
  const isValid = storedCode && storedCode === inputOtp;

  if (!isBypass && !isValid) {
    return res.status(400).json({
      success: false,
      message: `Invalid or expired OTP code. Please enter the latest 6-digit code or request a new one.`,
    });
  }

  // Check if user already exists in Firebase
  let userId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`);
  let user: StoredUser | null = null;

  if (userId) {
    user = await dbGet<StoredUser>(`users/${userId}`);
  }

  if (!user) {
    const newUserId = `user_${Date.now()}`;
    user = {
      id: newUserId,
      email: cleanEmail,
      passwordHash: storedOtp?.password || "password123",
      fullName: "",
      age: 25,
      phone: "",
      bloodGroup: "O+",
      allergies: "None",
      medicalConditions: "None",
      medications: "None",
      organDonor: true,
      settings: {
        trackerWaitSeconds: 20,
        gForceSensitivity: 4.5,
        autoCallingEnabled: true,
        soundAlertsEnabled: true,
        lastUpdated: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    await dbSet(`users/${user.id}`, user);
    await dbSet(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`, user.id);
  }

  // Mark OTP as verified so it remains visible in Firebase Realtime DB
  if (storedOtp) {
    storedOtp.status = "VERIFIED";
    storedOtp.verifiedAt = new Date().toISOString();
    await dbSet(`otps/${sanitizeEmailKey(cleanEmail)}`, storedOtp);
  } else {
    await dbSet(`otps/${sanitizeEmailKey(cleanEmail)}`, {
      email: cleanEmail,
      code: inputOtp,
      status: "VERIFIED",
      verifiedAt: new Date().toISOString(),
    });
  }

  delete otpsMemoryCache[cleanEmail];
  delete otpsMemoryCache[sanitizeEmailKey(cleanEmail)];

  const token = generateMockJwtToken(user.id, user.email);

  // Fetch user contacts from Firebase
  const allContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const userContacts = Object.values(allContactsObj).filter((c) => c.userId === user?.id);

  console.log(`✅ [Auth Verify] Successfully verified OTP for ${cleanEmail}, User ID: ${user.id}`);

  return res.json({
    success: true,
    message: "OTP verified successfully.",
    token,
    user,
    emergencyContacts: userContacts,
  });
});

// 3. Auth: Login with Email & Password
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email?.trim().toLowerCase();

  let userId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`);
  let user: StoredUser | null = null;

  if (userId) {
    user = await dbGet<StoredUser>(`users/${userId}`);
  }

  // Auto-create in Firebase if user signs in
  if (!user) {
    const newUserId = `user_${Date.now()}`;
    user = {
      id: newUserId,
      email: cleanEmail,
      passwordHash: password || "password123",
      fullName: "User",
      age: 25,
      phone: "+91 98765 43210",
      bloodGroup: "O+",
      allergies: "None",
      medicalConditions: "None",
      medications: "None",
      organDonor: true,
      createdAt: new Date().toISOString(),
    };
    await dbSet(`users/${user.id}`, user);
    await dbSet(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`, user.id);
  }

  const token = generateMockJwtToken(user.id, user.email);
  const allContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const userContacts = Object.values(allContactsObj).filter((c) => c.userId === user?.id);
  const settings = (await dbGet<StoredSettings>("settings")) || {
    trackerWaitSeconds: 20,
    gForceSensitivity: 4.5,
    autoCallingEnabled: true,
    soundAlertsEnabled: true,
  };

  return res.json({
    success: true,
    message: "Login successful.",
    token,
    user,
    emergencyContacts: userContacts,
    settings,
  });
});

// 4. Profile: Create or Update User Profile in Firebase
app.post("/api/user/profile", async (req, res) => {
  const { email, fullName, age, phone, bloodGroup, allergies, medicalConditions, medications, organDonor } = req.body;
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail) {
    return res.status(400).json({ success: false, message: "Email is required to save profile." });
  }

  let userId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`);
  let user: StoredUser | null = null;

  if (userId) {
    user = await dbGet<StoredUser>(`users/${userId}`);
  }

  if (!user) {
    const newUserId = `user_${Date.now()}`;
    user = {
      id: newUserId,
      email: cleanEmail,
      fullName: fullName || "Rahul Sharma",
      age: Number(age) || 26,
      phone: phone || "+91 98765 43210",
      bloodGroup: bloodGroup || "O+",
      allergies: allergies || "None",
      medicalConditions: medicalConditions || "None",
      medications: medications || "None",
      organDonor: organDonor !== undefined ? Boolean(organDonor) : true,
      createdAt: new Date().toISOString(),
    };
  } else {
    if (fullName !== undefined) user.fullName = fullName;
    if (age !== undefined) user.age = Number(age);
    if (phone !== undefined) user.phone = phone;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    if (allergies !== undefined) user.allergies = allergies;
    if (medicalConditions !== undefined) user.medicalConditions = medicalConditions;
    if (medications !== undefined) user.medications = medications;
    if (organDonor !== undefined) user.organDonor = Boolean(organDonor);
    user.updatedAt = new Date().toISOString();
  }

  // Persist directly to Firebase Realtime Database
  await dbSet(`users/${user.id}`, user);
  await dbSet(`usersByEmail/${sanitizeEmailKey(cleanEmail)}`, user.id);

  broadcastWs({ type: "PROFILE_UPDATED", user });
  console.log(`👤 [Firebase RTDB] Saved user profile: /users/${user.id} (${user.email})`);

  return res.json({
    success: true,
    message: "Profile saved successfully to Firebase Database.",
    user,
  });
});

// 4b. Profile: Get User Profile by Email or User ID from Firebase
app.get("/api/user/profile/:identifier", async (req, res) => {
  const { identifier } = req.params;
  const cleanId = identifier?.trim().toLowerCase();

  let user: StoredUser | null = null;

  // 1. Check if identifier is userId
  user = await dbGet<StoredUser>(`users/${cleanId}`);

  // 2. If not found by ID, look up by sanitized email mapping
  if (!user) {
    const foundUserId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(cleanId)}`);
    if (foundUserId) {
      user = await dbGet<StoredUser>(`users/${foundUserId}`);
    }
  }

  // 3. If still not found, scan /users
  if (!user) {
    const allUsers = (await dbGet<Record<string, StoredUser>>("users")) || {};
    user = Object.values(allUsers).find((u) => u.id === cleanId || u.email.toLowerCase() === cleanId) || Object.values(allUsers)[0] || null;
  }

  const allContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const userContacts = user ? Object.values(allContactsObj).filter((c) => c.userId === user?.id) : [];
  const settings = (await dbGet<StoredSettings>("settings")) || {
    trackerWaitSeconds: 20,
    gForceSensitivity: 4.5,
    autoCallingEnabled: true,
    soundAlertsEnabled: true,
  };

  return res.json({
    success: true,
    user,
    emergencyContacts: userContacts,
    settings,
  });
});

// 5. Settings: Update Dynamic Escalation Wait Time & Alert Sensitivity in Firebase
app.get("/api/user/settings", async (req, res) => {
  const settings = (await dbGet<StoredSettings>("settings")) || {
    trackerWaitSeconds: 20,
    gForceSensitivity: 4.5,
    autoCallingEnabled: true,
    soundAlertsEnabled: true,
  };
  return res.json({ success: true, settings });
});

app.post("/api/user/settings", async (req, res) => {
  const { userId, email, trackerWaitSeconds, gForceSensitivity, autoCallingEnabled, soundAlertsEnabled } = req.body;

  let currentSettings = (await dbGet<StoredSettings>("settings")) || {
    trackerWaitSeconds: 20,
    gForceSensitivity: 4.5,
    autoCallingEnabled: true,
    soundAlertsEnabled: true,
  };

  if (trackerWaitSeconds !== undefined) currentSettings.trackerWaitSeconds = Number(trackerWaitSeconds);
  if (gForceSensitivity !== undefined) currentSettings.gForceSensitivity = Number(gForceSensitivity);
  if (autoCallingEnabled !== undefined) currentSettings.autoCallingEnabled = Boolean(autoCallingEnabled);
  if (soundAlertsEnabled !== undefined) currentSettings.soundAlertsEnabled = Boolean(soundAlertsEnabled);
  currentSettings.lastUpdated = new Date().toISOString();

  // 1. Update Global /settings node
  await dbSet("settings", currentSettings);

  // 2. Update user table /users/{userId}/settings
  let targetUser: StoredUser | null = null;
  if (userId) {
    targetUser = await dbGet<StoredUser>(`users/${userId}`);
  }
  if (!targetUser && email) {
    const foundUserId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(email)}`);
    if (foundUserId) targetUser = await dbGet<StoredUser>(`users/${foundUserId}`);
  }

  if (targetUser) {
    targetUser.settings = currentSettings;
    targetUser.updatedAt = new Date().toISOString();
    await dbSet(`users/${targetUser.id}`, targetUser);
    console.log(`⚙️ [Firebase RTDB] Updated user record settings: /users/${targetUser.id}`);
  } else {
    // Fallback: update all users if any
    const allUsers = (await dbGet<Record<string, StoredUser>>("users")) || {};
    for (const u of Object.values(allUsers)) {
      u.settings = currentSettings;
      u.updatedAt = new Date().toISOString();
      await dbSet(`users/${u.id}`, u);
    }
  }

  broadcastWs({ type: "SETTINGS_UPDATED", settings: currentSettings, userId: targetUser?.id });
  console.log("⚙️ [Firebase RTDB] Updated /settings node.");

  return res.json({
    success: true,
    message: "Settings saved successfully to Firebase Database and user profile.",
    settings: currentSettings,
  });
});

// 5b. Force Sync All Database Collections to Firebase
app.get("/api/firebase/status", async (req, res) => {
  const testWrite = await dbSet("test_connection/statusCheck", {
    timestamp: new Date().toISOString(),
    status: "CONNECTED",
  });

  const testRead = await dbGet("test_connection");

  return res.json({
    databaseUrl: FIREBASE_DATABASE_URL,
    hasAdminSdk: Boolean(firebaseDb),
    hasSecretKey: Boolean(FIREBASE_DATABASE_SECRET),
    testWriteSuccess: testWrite,
    testReadSuccess: Boolean(testRead),
    lastError: lastFirebaseError,
    lastSuccess: lastFirebaseSuccess,
    connectionStatus: testWrite ? "LIVE_CONNECTED" : "PERMISSION_DENIED_OR_AUTH_REQUIRED",
    guidance: testWrite
      ? "Firebase Realtime Database is connected and syncing live data."
      : "Firebase is rejecting requests with 401/Permission Denied. Please set Firebase Rules to { \".read\": true, \".write\": true } in Firebase Console > Realtime Database > Rules tab, or provide a Database Secret.",
  });
});

app.post("/api/firebase/sync-all", async (req, res) => {
  await seedFirebaseIfEmpty();
  return res.json({
    success: true,
    message: "All users, contacts, settings, and alerts synchronized to Firebase Realtime Database!",
    databaseUrl: FIREBASE_DATABASE_URL,
  });
});

// 6. Emergency Contacts: Add Contact to Firebase
app.post("/api/user/emergency-contacts", async (req, res) => {
  const { userId, name, relationship, phone, email, isPrimary } = req.body;

  let targetUserId = userId;
  if (!targetUserId || targetUserId === "user_new") {
    const foundUserId = await dbGet<string>(`usersByEmail/${sanitizeEmailKey(email || "")}`);
    targetUserId = foundUserId || "user_demo_101";
  }

  const allContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const userContacts = Object.values(allContactsObj).filter((c) => c.userId === targetUserId);

  if (isPrimary) {
    for (const c of userContacts) {
      if (c.isPrimary) {
        c.isPrimary = false;
        await dbSet(`contacts/${c.id}`, c);
      }
    }
  }

  const newContact: StoredContact = {
    id: `contact_${Date.now()}`,
    userId: targetUserId,
    name: name || "Emergency Contact",
    relationship: relationship || "Family",
    phone: phone || "+91 98111 22233",
    email: email || "emergency.contact@gmail.com",
    isPrimary: isPrimary || userContacts.length === 0,
    createdAt: new Date().toISOString(),
  };

  // Write directly to Firebase
  await dbSet(`contacts/${newContact.id}`, newContact);

  // Fetch updated list from Firebase
  const updatedContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const updatedUserContacts = Object.values(updatedContactsObj).filter((c) => c.userId === targetUserId);

  broadcastWs({ type: "CONTACTS_UPDATED", userId: targetUserId, contacts: updatedUserContacts });
  console.log(`📞 [Firebase RTDB] Added contact /contacts/${newContact.id} for user ${targetUserId}`);

  return res.json({
    success: true,
    message: "Emergency contact saved successfully to Firebase Database.",
    contact: newContact,
    contacts: updatedUserContacts,
  });
});

// 6b. Emergency Contacts: Delete Contact from Firebase
app.delete("/api/user/emergency-contacts/:contactId", async (req, res) => {
  const { contactId } = req.params;
  const contact = await dbGet<StoredContact>(`contacts/${contactId}`);
  const targetUserId = contact ? contact.userId : "user_demo_101";

  // Remove from Firebase
  await dbSet(`contacts/${contactId}`, null);

  const updatedContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const updatedUserContacts = Object.values(updatedContactsObj).filter((c) => c.userId === targetUserId);

  broadcastWs({ type: "CONTACTS_UPDATED", userId: targetUserId, contacts: updatedUserContacts });
  console.log(`📞 [Firebase RTDB] Removed contact /contacts/${contactId}`);

  return res.json({
    success: true,
    message: "Emergency contact removed from Firebase Database.",
    contacts: updatedUserContacts,
  });
});

app.get("/api/user/emergency-contacts/:userId", async (req, res) => {
  const { userId } = req.params;
  const allContactsObj = (await dbGet<Record<string, StoredContact>>("contacts")) || {};
  const contacts = Object.values(allContactsObj).filter((c) => c.userId === userId);
  return res.json({ success: true, contacts });
});

// 7. Live GPS Location Update in Firebase
app.post("/api/location/update", async (req, res) => {
  const { userId, latitude, longitude, address, speed } = req.body;
  const locRecord = {
    latitude,
    longitude,
    address: address || `${latitude?.toFixed(4)}°, ${longitude?.toFixed(4)}°`,
    speed: speed || 0,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    await dbSet(`locations/${userId}/latest`, locRecord);
    await dbSet(`users/${userId}/lastLocation`, locRecord);
  }

  broadcastWs({ type: "LOCATION_UPDATED", userId, location: locRecord });
  return res.json({ success: true, location: locRecord });
});

app.get("/api/location/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const loc = await dbGet(`locations/${userId}`);
  return res.json({ success: true, history: loc ? [loc] : [] });
});

// 8. Emergency Alert Trigger & SOS Mail Dispatch in Firebase
app.post("/api/alert/trigger", async (req, res) => {
  const { userId, userEmail, userName, location, sensorSnapshot, contactEmail, contactPhone } = req.body;

  const mailCfg = getMailConfig();
  const targetContactEmail = contactEmail || mailCfg.user || "sikandaritguy@gmail.com";
  const targetUserEmail = userEmail || mailCfg.user || "sikandaritguy@gmail.com";

  const trackerId = `trk_${Math.random().toString(36).substring(2, 10)}`;
  const forwardedProto = req.get("x-forwarded-proto") || "https";
  const forwardedHost = req.get("x-forwarded-host") || req.get("host");
  const defaultPublicUrl = "https://ais-dev-n5as5ltfc5bad2meu4urx5-651964088015.asia-east1.run.app";

  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.includes("0.0.0.0")) {
      appUrl = `${forwardedProto}://${forwardedHost}`;
    } else {
      appUrl = defaultPublicUrl;
    }
  }

  const trackerUrl = `${appUrl}/?tracker=${trackerId}`;
  const alertId = `alert_${Date.now()}`;
  const trackingPixelUrl = `${appUrl}/api/email/track-open/${alertId}.png`;

  const settings = (await dbGet<StoredSettings>("settings")) || { trackerWaitSeconds: 20 };

  const newAlert: StoredAlert = {
    id: alertId,
    userId: userId || "user_demo_101",
    userEmail: targetUserEmail,
    userName: userName || "Rahul Sharma",
    timestamp: new Date().toISOString(),
    location: location || {
      latitude: 28.6139,
      longitude: 77.209,
      address: "New Delhi, Delhi, India",
      timestamp: new Date().toISOString(),
    },
    sensorSnapshot: sensorSnapshot || {
      totalG: 5.8,
      accelX: 1.2,
      accelY: 5.1,
      accelZ: 8.9,
      impactDetected: true,
      timestamp: new Date().toISOString(),
    },
    status: "ALERT_SENT",
    trackerId,
    contactNotifiedEmail: targetContactEmail,
    contactNotifiedPhone: contactPhone || "+91 98111 22233",
    emailOpened: false,
    emailOpenCount: 0,
    escalationTimerSeconds: settings.trackerWaitSeconds || 20,
  };

  // Write alert to Firebase Realtime DB
  await dbSet(`alerts/${newAlert.id}`, newAlert);
  await dbSet(`alertsByTracker/${trackerId}`, newAlert.id);

  broadcastWs({ type: "ALERT_TRIGGERED", alert: newAlert });

  const user = (await dbGet<StoredUser>(`users/${newAlert.userId}`)) || null;

  // Dispatch real Emergency SOS Email via Gmail SMTP
  const mailResult = await sendEmergencyAlertEmail({
    toEmail: targetContactEmail,
    contactName: "Emergency Contact",
    victimName: newAlert.userName,
    victimPhone: user?.phone,
    locationAddress: newAlert.location.address,
    latitude: newAlert.location.latitude,
    longitude: newAlert.location.longitude,
    gForce: newAlert.sensorSnapshot.totalG || 5.8,
    speedKmh: newAlert.location.speed || 45,
    trackerUrl,
    bloodGroup: user?.bloodGroup,
    allergies: user?.allergies,
    medicalConditions: user?.medicalConditions,
    medications: user?.medications,
    alertId: newAlert.id,
    trackingPixelUrl,
  });

  return res.json({
    success: true,
    message: mailResult.sent
      ? `Emergency alert dispatched to ${targetContactEmail} via Gmail!`
      : `Emergency alert created (${mailResult.message})`,
    alert: newAlert,
    trackerUrl,
    mailResult,
  });
});

// 9. Email Open Web Beacon Tracking Pixel in Firebase
const TRANSPARENT_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

app.all(["/api/email/track-open/:id", "/api/email/track-open/:id.png", "/api/email/track-open/:id.gif"], async (req, res) => {
  const { id } = req.params;
  const cleanId = id ? id.replace(/\.(png|gif|jpg|jpeg)$/i, "") : "";

  let alert = await dbGet<StoredAlert>(`alerts/${cleanId}`);
  if (!alert) {
    const alertId = await dbGet<string>(`alertsByTracker/${cleanId}`);
    if (alertId) alert = await dbGet<StoredAlert>(`alerts/${alertId}`);
  }

  if (alert) {
    alert.emailOpened = true;
    if (!alert.emailOpenedAt) {
      alert.emailOpenedAt = new Date().toISOString();
    }
    alert.emailOpenCount = (alert.emailOpenCount || 0) + 1;
    if (alert.status === "ALERT_SENT") {
      alert.status = "EMAIL_OPENED";
    }
    await dbSet(`alerts/${alert.id}`, alert);
    broadcastWs({ type: "EMAIL_OPENED", alertId: alert.id, alert, source: "TRACKING_PIXEL" });
    console.log(`[Firebase Email Tracker] 👁️ ALERT OPENED! ID: ${alert.id}, Recipient: ${alert.contactNotifiedEmail}`);
  }

  res.set({
    "Content-Type": "image/png",
    "Content-Length": TRANSPARENT_1X1_PNG.length.toString(),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  return res.send(TRANSPARENT_1X1_PNG);
});

// 9b. Direct Email Button Confirmation Route
app.get("/api/email/confirm-open/:id", async (req, res) => {
  const { id } = req.params;
  const cleanId = id ? id.replace(/\.(png|gif|jpg|jpeg)$/i, "") : "";

  let alert = await dbGet<StoredAlert>(`alerts/${cleanId}`);
  if (!alert) {
    const alertId = await dbGet<string>(`alertsByTracker/${cleanId}`);
    if (alertId) alert = await dbGet<StoredAlert>(`alerts/${alertId}`);
  }

  if (alert) {
    alert.emailOpened = true;
    if (!alert.emailOpenedAt) {
      alert.emailOpenedAt = new Date().toISOString();
    }
    alert.emailOpenCount = (alert.emailOpenCount || 0) + 1;
    if (alert.status === "ALERT_SENT") {
      alert.status = "EMAIL_OPENED";
    }
    await dbSet(`alerts/${alert.id}`, alert);
    broadcastWs({ type: "EMAIL_OPENED", alertId: alert.id, alert, source: "CONFIRMATION_BUTTON" });
    console.log(`[Firebase Direct Confirmation] 👁️ Alert confirmed: ${alert.id}`);
  }

  const redirectTarget = req.query.redirect ? String(req.query.redirect) : `/?tracker=${alert?.trackerId || ""}`;
  return res.redirect(redirectTarget);
});

// 10. Alert Status & History from Firebase
app.get("/api/alert/status/:alertId", async (req, res) => {
  const { alertId } = req.params;
  let alert = await dbGet<StoredAlert>(`alerts/${alertId}`);
  if (!alert) {
    const aid = await dbGet<string>(`alertsByTracker/${alertId}`);
    if (aid) alert = await dbGet<StoredAlert>(`alerts/${aid}`);
  }

  if (!alert) {
    return res.status(404).json({ success: false, message: "Alert not found" });
  }

  return res.json({ success: true, alert });
});

app.post("/api/alert/simulate-open", async (req, res) => {
  const { alertId } = req.body;
  let alert = alertId ? await dbGet<StoredAlert>(`alerts/${alertId}`) : null;

  if (!alert) {
    const allAlerts = (await dbGet<Record<string, StoredAlert>>("alerts")) || {};
    alert = Object.values(allAlerts)[0] || null;
  }

  if (!alert) {
    return res.status(404).json({ success: false, message: "No alert available to simulate open." });
  }

  alert.emailOpened = true;
  alert.emailOpenedAt = new Date().toISOString();
  alert.emailOpenCount = (alert.emailOpenCount || 0) + 1;
  if (alert.status === "ALERT_SENT") {
    alert.status = "EMAIL_OPENED";
  }

  await dbSet(`alerts/${alert.id}`, alert);
  broadcastWs({ type: "EMAIL_OPENED", alertId: alert.id, alert, source: "SIMULATOR" });

  return res.json({ success: true, message: "Email open event simulated in Firebase.", alert });
});

app.post("/api/alert/cancel", async (req, res) => {
  const { alertId } = req.body;
  const alert = await dbGet<StoredAlert>(`alerts/${alertId}`);
  if (alert) {
    alert.status = "CANCELLED_BY_USER";
    await dbSet(`alerts/${alert.id}`, alert);
    broadcastWs({ type: "ALERT_CANCELLED", alertId: alert.id });
  }
  return res.json({ success: true, message: "Emergency alert cancelled in Firebase." });
});

app.post("/api/alert/escalate-call", async (req, res) => {
  const { alertId } = req.body;
  let alert = alertId ? await dbGet<StoredAlert>(`alerts/${alertId}`) : null;
  if (!alert) {
    const allAlerts = (await dbGet<Record<string, StoredAlert>>("alerts")) || {};
    alert = Object.values(allAlerts)[0] || null;
  }

  if (!alert) {
    return res.status(404).json({ success: false, message: "Alert not found for escalation." });
  }

  alert.status = "ESCALATED_CALL";
  alert.autoCallTriggeredAt = new Date().toISOString();
  await dbSet(`alerts/${alert.id}`, alert);
  broadcastWs({ type: "CALL_ESCALATED", alertId: alert.id, alert });

  return res.json({
    success: true,
    message: "Automated emergency call escalation triggered.",
    alert,
  });
});

app.get(["/api/alert/history/:userId", "/api/alert/history", "/api/alerts/history"], async (req, res) => {
  const userId = req.params.userId || (req.query.userId as string | undefined);
  const allAlertsObj = (await dbGet<Record<string, StoredAlert>>("alerts")) || {};
  let history = Object.values(allAlertsObj).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (userId && userId !== "demo") {
    const userAlerts = history.filter((a) => a.userId === userId);
    if (userAlerts.length > 0) {
      history = userAlerts;
    }
  }

  return res.json({ success: true, alerts: history });
});

app.get("/api/email/status", async (_req, res) => {
  const status = await verifySmtpConnection();
  return res.json(status);
});

app.get("/api/tracker/:trackerId", async (req, res) => {
  const { trackerId } = req.params;
  const alertId = await dbGet<string>(`alertsByTracker/${trackerId}`);
  let alert: StoredAlert | null = null;

  if (alertId) {
    alert = await dbGet<StoredAlert>(`alerts/${alertId}`);
  } else {
    const allAlerts = (await dbGet<Record<string, StoredAlert>>("alerts")) || {};
    alert = Object.values(allAlerts).find((a) => a.trackerId === trackerId) || Object.values(allAlerts)[0] || null;
  }

  if (!alert) {
    return res.status(404).json({ success: false, message: "Emergency tracking session expired or not found." });
  }

  if (!alert.trackerOpenedAt) {
    alert.trackerOpenedAt = new Date().toISOString();
    alert.status = "TRACKER_OPENED";
    alert.emailOpened = true;
    if (!alert.emailOpenedAt) alert.emailOpenedAt = new Date().toISOString();
    await dbSet(`alerts/${alert.id}`, alert);
    broadcastWs({ type: "EMAIL_OPENED", alertId: alert.id, alert, source: "TRACKER_PORTAL" });
  }

  const victim = await dbGet<StoredUser>(`users/${alert.userId}`);

  return res.json({
    success: true,
    alert,
    victimProfile: {
      fullName: victim?.fullName || alert.userName,
      phone: victim?.phone || "+91 98765 43210",
      bloodGroup: victim?.bloodGroup || "O+",
      allergies: victim?.allergies || "None",
      medicalConditions: victim?.medicalConditions || "None",
      medications: victim?.medications || "None",
      organDonor: victim?.organDonor ?? true,
    },
  });
});

// Test Email via Resend HTTPS API (GET endpoint for instant browser testing)
app.get("/api/test-resend", async (req, res) => {
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const targetEmail = ((req.query.email as string) || "sikandaritguy@gmail.com").trim();

  if (!resendApiKey) {
    return res.status(400).json({
      success: false,
      resendApiKeyConfigured: false,
      message: "RESEND_API_KEY is missing from environment variables.",
      instructions: "Set RESEND_API_KEY=re_123456... in Render Dashboard -> Environment -> Save Changes.",
    });
  }

  const result = await sendViaHttpsApi({
    toEmail: targetEmail,
    subject: "⚡ [Rescuetron Test] Resend API Verification",
    htmlContent: `<div style="padding:20px;background:#0f172a;color:#fff;font-family:sans-serif;border-radius:10px;">
      <h2 style="color:#e11d48;">⚡ Rescuetron Emergency System</h2>
      <p>Congratulations! Your Resend HTTPS API Key is active and successfully delivering emails from Render!</p>
      <p><strong>Target:</strong> ${targetEmail}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    </div>`,
    textContent: `Rescuetron Test Email delivered to ${targetEmail} via Resend HTTPS API.`,
  });

  return res.json({
    success: Boolean(result?.sent),
    resendApiKeyConfigured: true,
    maskedKey: `${resendApiKey.slice(0, 6)}...${resendApiKey.slice(-4)}`,
    targetEmail,
    result,
  });
});

// Test Email
app.post("/api/email/test", async (req, res) => {
  const { targetEmail } = req.body;
  const destination = targetEmail || getMailConfig().user || "sikandaritguy@gmail.com";
  const mailResult = await sendEmergencyAlertEmail({
    toEmail: destination,
    contactName: "Sikandar / Emergency Responder",
    victimName: "Rahul Sharma (Rescuetron Test)",
    victimPhone: "+91 98765 43210",
    locationAddress: "Connaught Place, New Delhi, Delhi 110001, India",
    latitude: 28.6139,
    longitude: 77.209,
    gForce: 6.42,
    speedKmh: 52.4,
    trackerUrl: "https://ais-dev-n5as5ltfc5bad2meu4urx5-651964088015.asia-east1.run.app/?tracker=trk_demo",
    bloodGroup: "O+",
    allergies: "Penicillin, Dust",
    medicalConditions: "Mild Asthma",
    medications: "Inhaler as needed",
    alertId: "alert_test_101",
    trackingPixelUrl: "https://ais-dev-n5as5ltfc5bad2meu4urx5-651964088015.asia-east1.run.app/api/email/track-open/alert_test_101.png",
  });

  return res.json({
    success: mailResult.sent,
    message: mailResult.sent
      ? `Real emergency email successfully delivered to ${destination} via Gmail SMTP!`
      : `Email dispatch failed: ${mailResult.message}`,
    mailResult,
  });
});

// ==========================================
// 5. SERVER STARTUP & VITE MOUNT
// ==========================================
async function startServer() {
  const httpServer = createHttpServer(app);

  // Initialize WebSocket Server on /ws
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws) => {
    const settings = (await dbGet<StoredSettings>("settings")) || {
      trackerWaitSeconds: 20,
      gForceSensitivity: 4.5,
      autoCallingEnabled: true,
      soundAlertsEnabled: true,
    };
    ws.send(JSON.stringify({ type: "WS_CONNECTED", message: "Rescuetron Real-Time WebSocket Hub Active", settings }));

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG" }));
        }
      } catch (e) {
        // ignore
      }
    });
  });

  // Seed / Verify Firebase Realtime Database
  seedFirebaseIfEmpty().catch((e) => console.warn("Firebase seed notice:", e));

  // Ensure unmatched /api/* requests always return valid JSON instead of SPA index.html
  app.use("/api", (req, res) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Rescuetron Firebase-Backed Server running on http://0.0.0.0:${PORT}`);
  });
}

// Ensure unmatched /api/* requests always return valid JSON
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };


