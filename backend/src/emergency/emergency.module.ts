import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { FirebaseService } from '../firebase/firebase.service';

@Module({
  controllers: [EmergencyController],
  providers: [EmergencyService, FirebaseService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
