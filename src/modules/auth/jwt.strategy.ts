import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { REDIS_CONNECTION } from '@config/constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisClient: any,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWTKEY,
    });
  }

  async validate(payload: any) {
    const redisKey = `app_auth:${payload.user_id}:token:${payload.jti}`;
    const userData = await this.redisClient.get(redisKey);
    if (!userData) {
      throw new UnauthorizedException('Session expired or revoked');
    }
    return JSON.parse(userData);
  }
}
