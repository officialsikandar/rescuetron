import { Controller, Post, Body } from '@nestjs/common';

@Controller('location')
export class LocationController {
  @Post('update')
  updateLocation(@Body() body: { userId: string; latitude: number; longitude: number; address: string }) {
    return {
      success: true,
      message: 'Location updated successfully',
      timestamp: new Date().toISOString(),
      location: body,
    };
  }
}
