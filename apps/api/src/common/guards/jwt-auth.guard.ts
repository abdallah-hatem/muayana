import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@muayana/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard (APP_GUARD): every route needs a valid access token unless marked @Public().
 * Missing, garbage and expired tokens all answer the same 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        message: 'Sign in to continue',
        error: ErrorCode.UNAUTHORIZED,
      });
    }
    return user;
  }
}
