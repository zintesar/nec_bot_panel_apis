import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStrategy } from './jwt-refresh.strategy';
import { JwtAuthGuard, JwtRefreshAuthGuard } from './guards';
import { userProviders } from './user.providers';
import { RedisModule } from '../../config/redis/redis.module';
import { DatabaseModule } from '../../config/database/database.module';
import { decrypt } from '@helpers/cipher';

const IS_CRD_PLAIN = process.env.IS_CRD_PLAIN === 'true';
const JWTKEY = IS_CRD_PLAIN
  ? process.env.JWTKEY
  : decrypt(process.env.JWTKEY);

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: JWTKEY,
      signOptions: { expiresIn: process.env.TOKEN_EXPIRATION },
    }),
    DatabaseModule,
    RedisModule,
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RefreshTokenStrategy,
    JwtAuthGuard,
    JwtRefreshAuthGuard,
    ...userProviders,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtRefreshAuthGuard, JwtModule],
})
export class AuthModule { }
