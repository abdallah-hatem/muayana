import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type {
  CurrentUser,
  JwtPayload,
} from '../../../common/interfaces/current-user.interface';
import type { Env } from '../../../config/env.validation';
import { AuthUserRepository } from '../repositories/auth-user.repository';

/**
 * Verifies the bearer token's signature and expiry, then that the user still exists (a token
 * outliving its account stops working at once).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: AuthUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: Partial<JwtPayload>): Promise<CurrentUser> {
    if (
      typeof payload.sub !== 'string' ||
      !(await this.users.exists(payload.sub))
    )
      throw new UnauthorizedException();
    return { id: payload.sub };
  }
}
