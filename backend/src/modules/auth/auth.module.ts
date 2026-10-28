import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginGuardService } from './login-guard.service';
import { MfaService } from './mfa.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginGuardService, MfaService],
  exports: [AuthService],
})
export class AuthModule {}
