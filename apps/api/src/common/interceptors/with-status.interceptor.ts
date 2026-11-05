import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * A result whose HTTP status is decided at runtime (e.g. an idempotent create: 201 when made,
 * 200 when the id already existed). Return it from a route marked
 * `@UseInterceptors(WithStatusInterceptor)`; controllers never touch the response object.
 */
export class WithStatus<T> {
  constructor(
    readonly status: number,
    readonly body: T,
  ) {}
}

/** Applies a WithStatus result's status and hands its body on to the envelope. */
@Injectable()
export class WithStatusInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((value: unknown) => {
        if (!(value instanceof WithStatus)) return value;
        response.status(value.status);
        return value.body as unknown;
      }),
    );
  }
}
