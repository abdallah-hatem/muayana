import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LOGIN_ATTEMPT_STORE } from './interfaces/login-attempt-store.interface';
import { AuthUserRepository } from './repositories/auth-user.repository';
import { InMemoryLoginAttemptStore } from './repositories/in-memory-login-attempt.store';
import { JwtStrategy } from './strategies/jwt.strategy';

/** Sign-in, the token strategy the global JwtAuthGuard uses, and the engineer's own account. */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    AuthUserRepository,
    { provide: LOGIN_ATTEMPT_STORE, useClass: InMemoryLoginAttemptStore },
  ],
})
export class AuthModule {}
