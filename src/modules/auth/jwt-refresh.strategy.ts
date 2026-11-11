import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY } from '@config/constants';
import { UserModel } from '@models/index';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: process.env.REFRESH_KEY,
    });
  }

  async validate(payload: any) {
    const userId = payload.user_id || payload.id;
    const user = await (this.userRepository as any).findByPk(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentVersion = user.Token_Version ?? 1;
    const tokenVersion = payload.token_version ?? 1;

    if (currentVersion !== tokenVersion) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const plainUser = user.get({ plain: true });
    const { password: _pw, Password: _pw2, ...result } = plainUser;
    return {
      ...result,
      id: userId,
      user_id: userId,
    };
  }
}

