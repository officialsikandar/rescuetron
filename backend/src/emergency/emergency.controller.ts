import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { DispatchAlertDto } from './dto/alert.dto';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('dispatch')
  dispatchAlert(@Body() dto: DispatchAlertDto) {
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

  @Post('cancel/:alertId')
  cancelAlert(@Param('alertId') alertId: string) {
    return this.emergencyService.cancelAlert(alertId);
  }
}
