import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, LoginDto, UpdateProfileDto, AddContactDto } from './dto/auth.dto';

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

  @Post('profile')
  updateProfile(@Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(dto);
  }

  @Post('contacts')
  addContact(@Body() dto: AddContactDto) {
    return this.authService.addContact(dto);
  }
}
