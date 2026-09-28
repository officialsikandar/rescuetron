import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EmergencyModule } from './emergency/emergency.module';
import { LocationModule } from './location/location.module';
import { FirebaseService } from './firebase/firebase.service';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [AuthModule, EmergencyModule, LocationModule, MailModule],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class AppModule {}
