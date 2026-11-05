import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { CurrentUser } from '../interfaces/current-user.interface';

/**
 * The caller (`@GetUser() user`) or one of its fields (`@GetUser('id') id`), from the verified
 * token. Ownership is always decided from this, never from an id in the body or params.
 */
export const GetUser = createParamDecorator(
  (field: keyof CurrentUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>().user;
    if (!user) throw new UnauthorizedException();
    return field ? user[field] : user;
  },
);
