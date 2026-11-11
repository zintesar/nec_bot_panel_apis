import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWTKEY,
    });
  }

  async validate(payload: any) {
    // Pure stateless verification: Passport validates the cryptographic signature & expiry.
    return {
      id: payload.user_id || payload.id,
      user_id: payload.user_id || payload.id,
      name: payload.name || payload.Name,
      email: payload.email || payload.Email,
      user_type: payload.user_type || payload.User_Type,
      ...payload,
    };
  }
}

