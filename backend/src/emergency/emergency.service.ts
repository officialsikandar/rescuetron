import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { DispatchAlertDto } from './dto/alert.dto';

@Injectable()
export class EmergencyService {
  constructor(
    private firebaseService: FirebaseService,
    private mailService: MailService,
  ) {}

  async dispatchAlert(dto: DispatchAlertDto) {
    const alertId = 'alt_' + Math.random().toString(36).substring(2, 9);
    const trackerId = 'trk_' + Math.random().toString(36).substring(2, 10);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const trackerUrl = `${appUrl}/?tracker=${trackerId}`;

    const newAlert = {
      id: alertId,
      userId: dto.userId,
      timestamp: new Date().toISOString(),
      status: 'DISPATCHED',
      location: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
      },
      sensorSnapshot: {
        totalG: dto.gForce,
        speedKmh: dto.speedKmh || 45.0,
      },
      trackerId,
      trackerUrl,
    };

    this.firebaseService.saveDocument('alerts', newAlert);
    console.log(`🚨 [NESTJS EMERGENCY] Alert ${alertId} created with tracker URL: ${trackerUrl}`);

    // Dispatch real email via Gmail SMTP
    const targetContactEmail = process.env.EMERGENCY_CONTACT_EMAIL || 'priya.emergency@gmail.com';
    this.mailService.sendEmergencyAlertEmail({
      toEmail: targetContactEmail,
      victimName: 'User',
      locationAddress: dto.address || `${dto.latitude}, ${dto.longitude}`,
      latitude: dto.latitude,
      longitude: dto.longitude,
      gForce: dto.gForce,
      trackerUrl,
    }).catch(err => console.error('NestJS mail dispatch error:', err));

    return {
      success: true,
      alert: newAlert,
    };
  }

  async getHistory(userId: string) {
    let alerts = this.firebaseService.filterDocuments('alerts', item => item.userId === userId);
    if (alerts.length === 0) {
      alerts = [
        {
          id: 'alt_demo1',
          userId,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'DISPATCHED',
          location: {
            latitude: 28.6139,
            longitude: 77.2090,
            address: 'Connaught Place, New Delhi, India',
          },
          sensorSnapshot: {
            totalG: 5.8,
            speedKmh: 52.0,
          },
          trackerId: 'trk_demo123',
          trackerUrl: 'http://localhost:3000/?tracker=trk_demo123',
        }
      ];
    }
    return alerts;
  }

  async getTrackerDetails(trackerId: string) {
    const alert = this.firebaseService.findDocument('alerts', item => item.trackerId === trackerId);
    if (alert) {
      alert.status = 'TRACKER_OPENED';
      this.firebaseService.saveDocument('alerts', alert);
    }

    const patientInfo = {
      fullName: 'Rahul Sharma',
      phone: '+91 98765 43210',
      age: 26,
      bloodGroup: 'O+',
      allergies: 'Penicillin, Dust',
      medicalConditions: 'Mild Asthma',
      medications: 'Inhaler as needed',
    };

    return {
      success: true,
      trackerId,
      alert: alert || {
        location: { latitude: 28.6139, longitude: 77.2090, address: 'Connaught Place, New Delhi, India' },
        sensorSnapshot: { totalG: 6.2 },
        timestamp: new Date().toISOString(),
      },
      patientInfo,
    };
  }

  async cancelAlert(alertId: string) {
    const alert = this.firebaseService.findDocument('alerts', item => item.id === alertId);
    if (alert) {
      alert.status = 'CANCELLED';
      this.firebaseService.saveDocument('alerts', alert);
    }
    return { success: true, message: 'Alert cancelled' };
  }
}
