import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_TTL_DAYS,
  AuthErrorCode,
  ErrorCode,
  type LoginResponse,
  type User,
} from '@muayana/shared';
import { CLOCK, type Clock } from '../../common/clock/clock';
import type { JwtPayload } from '../../common/interfaces/current-user.interface';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import {
  isLoginLocked,
  loginAttemptKey,
  loginWindowStart,
  retryAfterSeconds,
} from './auth.pure';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  LOGIN_ATTEMPT_STORE,
  type LoginAttemptStore,
} from './interfaces/login-attempt-store.interface';
import { AuthUserRepository } from './repositories/auth-user.repository';

/** One sentence for both wrong password and unknown email: nothing tells which it was. */
export const INVALID_CREDENTIALS_MESSAGE = 'Wrong email or password';

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so both failures take the same time. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: AuthUserRepository,
    private readonly jwt: JwtService,
    @Inject(LOGIN_ATTEMPT_STORE) private readonly attempts: LoginAttemptStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async login(dto: LoginDto, ip: string): Promise<LoginResponse> {
    const key = loginAttemptKey(ip, dto.email);
    const now = this.clock.now();
    const since = loginWindowStart(now);

    if (isLoginLocked(await this.attempts.countFailuresSince(key, since))) {
      const oldest = await this.attempts.oldestFailureSince(key, since);
      throw new HttpException(
        {
          message: 'Too many failed sign-in attempts. Try again later.',
          error: ErrorCode.TOO_MANY_REQUESTS,
          data: {
            retryAfterSeconds: oldest ? retryAfterSeconds(oldest, now) : 1,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findByEmailWithHash(dto.email);
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );
    if (!user || !valid) {
      await this.attempts.recordFailure(key, now);
      throw new UnauthorizedException({
        message: INVALID_CREDENTIALS_MESSAGE,
        error: AuthErrorCode.INVALID_CREDENTIALS,
      });
    }

    await this.attempts.clear(key);
    const { passwordHash: _hash, ...publicUser } = user;
    const payload: JwtPayload = { sub: user.id };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: `${ACCESS_TOKEN_TTL_DAYS}d`,
      }),
      user: publicUser,
    };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findPublicById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updateMe(userId: string, dto: UpdateMeDto): Promise<User> {
    return this.users.updateProfile(userId, {
      name: dto.name,
      locale: dto.locale,
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const hash = await this.users.findHashById(userId);
    if (!hash) throw new NotFoundException('User not found');
    if (!(await verifyPassword(dto.currentPassword, hash))) {
      throw new BadRequestException({
        message: 'The current password is wrong',
        error: AuthErrorCode.WRONG_PASSWORD,
      });
    }
    await this.users.updatePasswordHash(
      userId,
      await hashPassword(dto.newPassword),
    );
    return { ok: true };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('unknown-account-timing-equaliser');
    return this.dummyHash;
  }
}
