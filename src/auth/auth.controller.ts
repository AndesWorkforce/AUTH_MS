import { Controller, Get, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { getMessagePattern } from 'config';

import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto } from './dto/login-auth.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(getMessagePattern('auth.register.user'))
  async registerUser(@Payload() registerDto: RegisterUserDto) {
    return this.authService.registerUser(registerDto);
  }

  @MessagePattern(getMessagePattern('auth.register.client'))
  async registerClient(@Payload() registerDto: RegisterClientDto) {
    return this.authService.registerClient(registerDto);
  }

  @MessagePattern(getMessagePattern('auth.login'))
  async login(@Payload() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @MessagePattern(getMessagePattern('auth.refresh-token'))
  async refreshToken(@Payload() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @MessagePattern(getMessagePattern('auth.logout'))
  async logout(@Payload() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }

  @MessagePattern(getMessagePattern('auth.validate'))
  async validateToken(@Payload() token: string) {
    return this.authService.validateToken(token);
  }

  @Get('validate')
  async validateTokenHttp(@Query('token') token: string) {
    return this.authService.validateToken(token);
  }
}
