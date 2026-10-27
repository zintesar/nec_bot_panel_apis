import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { UNAUTHORIZED } from '../../helpers/responseHelper';
import 'dotenv/config';
import { decrypt } from '@helpers/cipher';

const IS_CRD_PLAIN = process.env.IS_CRD_PLAIN == 'true' ? true : false;
const AUTH_MODULE = IS_CRD_PLAIN
  ? process.env.AUTH_MODULE
  : decrypt(process.env.AUTH_MODULE);

/**
 * Guard to skip module check for an API call.
 * Usage: @UseGuards(skipModule) or @UseGuards(SkipModuleGuard)
 */
@Injectable()
export class SkipModuleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request) {
      request.skipModule = true;
    }
    return true;
  }
}

export const skipModule = SkipModuleGuard;
export const SkipModule = SkipModuleGuard;

@Injectable()
export class AuthModuleGuard implements CanActivate {
  private reflector: Reflector;

  constructor(reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request?.skipModule) {
      return true;
    }

    const handler = context.getHandler ? context.getHandler() : null;
    const targetClass = context.getClass ? context.getClass() : null;

    const handlerGuards =
      (handler && Reflect.getMetadata('__guards__', handler)) || [];
    const classGuards =
      (targetClass && Reflect.getMetadata('__guards__', targetClass)) || [];
    const reflectorGuards =
      (handler &&
        targetClass &&
        this.reflector?.getAllAndMerge<any[]>('__guards__', [
          handler,
          targetClass,
        ])) ||
      [];

    const allGuards = [
      ...handlerGuards,
      ...classGuards,
      ...reflectorGuards,
    ];

    const isSkipped = allGuards.some(
      (guard) =>
        guard === skipModule ||
        guard === SkipModuleGuard ||
        guard === SkipModule ||
        guard?.name === 'SkipModuleGuard' ||
        guard?.name === 'skipModule' ||
        guard instanceof SkipModuleGuard,
    );

    if (isSkipped) {
      return true;
    }

    return this.validateHeaderRequest(request);
  }

  async validateHeaderRequest(request) {
    const { headers = null } = request;

    if (!headers || !headers['module'] || headers['module'] != AUTH_MODULE) {
      throw new UnauthorizedException(UNAUTHORIZED(null, request));
    }

    return true;
  }
}
