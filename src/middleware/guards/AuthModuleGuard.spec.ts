import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthModuleGuard,
  SkipModuleGuard,
  skipModule,
} from './AuthModuleGuard';

describe('AuthModuleGuard with @UseGuards(skipModule)', () => {
  let guard: AuthModuleGuard;
  let reflector: Reflector;

  const mockContext = (
    headers: Record<string, string> = {},
    handler?: any,
    targetClass?: any,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          i18n: { __: (msg: string) => msg },
        }),
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => targetClass || class DummyController {},
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthModuleGuard(reflector);
  });

  describe('SkipModuleGuard', () => {
    it('should return true and mark request.skipModule', () => {
      const skip = new SkipModuleGuard();
      const req: any = {};
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as ExecutionContext;

      expect(skip.canActivate(context)).toBe(true);
      expect(req.skipModule).toBe(true);
    });
  });

  describe('AuthModuleGuard behavior with @UseGuards(skipModule)', () => {
    it('should allow access if handler has skipModule in __guards__', async () => {
      const handler = () => {};
      Reflect.defineMetadata('__guards__', [skipModule], handler);

      const context = mockContext({}, handler);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access if class has skipModule in __guards__', async () => {
      class TargetClass {}
      Reflect.defineMetadata('__guards__', [skipModule], TargetClass);

      const context = mockContext({}, null, TargetClass);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access if request.skipModule is true', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ skipModule: true, headers: {} }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject access if skipModule is not present and header is missing', async () => {
      const context = mockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
