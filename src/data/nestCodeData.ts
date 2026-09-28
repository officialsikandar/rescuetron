import { NestCodeFile } from '../types';

export const CODE_FILES: NestCodeFile[] = [
  // MOBILE APP FILES
  {
    path: 'mobile/src/config.ts',
    title: 'Mobile API Config (Connected to Live Hosted Backend)',
    description: 'Configured to connect your local React Native app directly to your hosted NestJS cloud server endpoint.',
    language: 'typescript',
    code: `// Config for React Native / Expo Mobile App

// Your Live Hosted Backend Server URL:
export const LIVE_BACKEND_URL = 'https://ais-dev-n5as5ltfc5bad2meu4urx5-651964088015.asia-east1.run.app/api';

const USE_LIVE_SERVER = true;

export const API_BASE_URL = USE_LIVE_SERVER ? LIVE_BACKEND_URL : 'http://localhost:3000/api';
`
  },
  {
    path: 'mobile/App.tsx',
    title: 'Mobile App.tsx (Expo & React Native)',
    description: 'React Navigation setup with Stack Navigator for Login, OTP, Profile, and Bottom Tabs.',
    language: 'typescript',
    code: `import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff' }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Sensors & GPS' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Emergency Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Otp" component={OtpScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}`
  },
  {
    path: 'mobile/src/services/api.ts',
    title: 'Mobile Axios API Service',
    description: 'Sends live HTTP requests from React Native directly to the NestJS cloud endpoints.',
    language: 'typescript',
    code: `import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({ baseURL: API_BASE_URL });

export const sendSignupOtp = (email: string) => api.post('/auth/send-otp', { email });
export const verifyOtpAndSignup = (email: string, otp: string, password: string) => api.post('/auth/verify-otp', { email, otp, password });
export const loginUser = (email: string, password: string) => api.post('/auth/login', { email, password });
export const dispatchEmergencyAlert = (payload: any) => api.post('/emergency/dispatch', payload);
`
  },
  // BACKEND FILES
  {
    path: 'backend/src/firebase/firebase.service.ts',
    title: 'NestJS Firebase Firestore Service',
    description: 'Initializes Firebase Admin SDK using service account credentials from environment variables.',
    language: 'typescript',
    code: `import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  public firestore: admin.firestore.Firestore;

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
        }),
      });
    }
    this.firestore = admin.firestore();
    console.log('⚡ [NestJS] Connected to Firebase Firestore Database successfully');
  }
}`
  },
  {
    path: 'backend/src/main.ts',
    title: 'NestJS Main Entry (main.ts)',
    description: 'Bootstraps NestJS server on port 3000 with CORS and /api global prefix.',
    language: 'typescript',
    code: `import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000, '0.0.0.0');
  console.log('🚀 NestJS API running on port 3000');
}
bootstrap();`
  },
  {
    path: 'backend/src/auth/auth.controller.ts',
    title: 'NestJS Auth Controller',
    description: 'Handles Email OTP generation, Signup, Login, and JWT Token issuance.',
    language: 'typescript',
    code: `import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, LoginDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndSignup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}`
  },
  {
    path: 'backend/src/emergency/emergency.controller.ts',
    title: 'NestJS Emergency Controller',
    description: 'Manages accident alerts, generates live tracker URLs, and updates tracker statuses.',
    language: 'typescript',
    code: `import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('dispatch')
  dispatchAlert(@Body() dto: any) {
    return this.emergencyService.dispatchAlert(dto);
  }

  @Get('history/:userId')
  getHistory(@Param('userId') userId: string) {
    return this.emergencyService.getHistory(userId);
  }

  @Get('tracker/:trackerId')
  getTrackerDetails(@Param('trackerId') trackerId: string) {
    return this.emergencyService.getTrackerDetails(trackerId);
  }
}`
  },
  {
    path: 'backend/src/mail/mail.service.ts',
    title: 'Gmail SMTP Mailer Service (Nodemailer)',
    description: 'Sends real HTML verification OTPs and emergency SOS crash notifications via personal Gmail SMTP.',
    language: 'typescript',
    code: `import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!user || !pass) {
      this.logger.warn('Gmail SMTP credentials not set in .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendOtpEmail(toEmail: string, otpCode: string) {
    if (!this.transporter) this.initTransporter();
    return this.transporter.sendMail({
      from: \`"Rescuetron System" <\${process.env.SMTP_USER}>\`,
      to: toEmail,
      subject: \`[Rescuetron] \${otpCode} is your Verification Code\`,
      html: \`<h2>Your OTP: \${otpCode}</h2><p>Expires in 10 minutes.</p>\`,
    });
  }
}`
  },
  {
    path: 'backend/.env',
    title: 'Gmail SMTP Environment Config',
    description: 'Configure your personal Gmail credentials & 16-character App Password.',
    language: 'bash',
    code: `# Personal Gmail SMTP Configuration
# 1. Enable 2-Step Verification in Google Account
# 2. Generate a 16-character App Password at: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_NAME="Rescuetron Emergency System"`
  }
];

export const NEST_CODE_FILES = CODE_FILES;

