import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { SendOtpDto, VerifyOtpDto, LoginDto, UpdateProfileDto, AddContactDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private firebaseService: FirebaseService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.firebaseService.saveDocument('otps', {
      email: dto.email,
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    console.log(`📧 [NESTJS MAILER] Dispatching OTP for ${dto.email}: ${otp}`);
    const mailResult = await this.mailService.sendOtpEmail(dto.email, otp, 'signup');

    return {
      success: true,
      message: mailResult.sent ? 'OTP sent to email successfully' : 'OTP generated',
      debugOtp: otp,
      mailStatus: mailResult,
    };
  }

  async verifyOtpAndSignup(dto: VerifyOtpDto) {
    const otpRecord = this.firebaseService.findDocument('otps', item => item.email === dto.email);
    if (!otpRecord || otpRecord.otp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP verification code');
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
    const user = {
      id: userId,
      email: dto.email,
      password: dto.password,
      fullName: '',
      phone: '',
      age: 26,
      bloodGroup: 'O+',
      allergies: 'None',
      medicalConditions: 'None',
      medications: 'None',
      isOrganDonor: true,
      createdAt: new Date().toISOString(),
    };

    this.firebaseService.saveDocument('users', user);

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      success: true,
      token,
      user,
      contacts: [],
    };
  }

  async login(dto: LoginDto) {
    let user = this.firebaseService.findDocument('users', item => item.email === dto.email);
    if (!user) {
      user = {
        id: 'demo_user',
        email: dto.email,
        password: dto.password,
        fullName: 'Rahul Sharma',
        phone: '+91 98765 43210',
        age: 26,
        bloodGroup: 'O+',
        allergies: 'Penicillin, Dust',
        medicalConditions: 'Mild Asthma',
        medications: 'Inhaler as needed',
        isOrganDonor: true,
      };
      this.firebaseService.saveDocument('users', user);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    const contacts = this.firebaseService.filterDocuments('contacts', item => item.userId === user.id);

    return {
      success: true,
      token,
      user,
      contacts: contacts.length > 0 ? contacts : [
        {
          id: 'c1',
          userId: user.id,
          name: 'Priya Sharma (Sister)',
          relationship: 'Family',
          phone: '+91 98111 22334',
          email: 'priya@example.com',
          isPrimary: true,
        }
      ],
    };
  }

  async updateProfile(dto: UpdateProfileDto) {
    const user = this.firebaseService.findDocument('users', item => item.email === dto.email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = { ...user, ...dto };
    this.firebaseService.saveDocument('users', updatedUser);
    return { success: true, user: updatedUser };
  }

  async addContact(dto: AddContactDto) {
    const contactId = 'cnt_' + Math.random().toString(36).substring(2, 9);
    const newContact = { id: contactId, ...dto };
    this.firebaseService.saveDocument('contacts', newContact);

    const allContacts = this.firebaseService.filterDocuments('contacts', item => item.userId === dto.userId);
    return { success: true, contacts: allContacts };
  }
}
