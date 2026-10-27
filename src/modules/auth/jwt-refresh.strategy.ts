import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { REDIS_CONNECTION } from '@config/constants';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisClient: any,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: process.env.REFRESH_KEY,
    });
  }

  async validate(payload: any) {
    const redisKey = `app_auth:${payload.user_id}:refreshToken:${payload.jti}`;
    const userData = await this.redisClient.get(redisKey);
    if (!userData) {
      throw new UnauthorizedException('Refresh session expired or revoked');
    }
    return JSON.parse(userData);
  }
}
