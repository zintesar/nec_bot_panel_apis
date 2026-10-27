import {
  Controller,
  Body,
  Post,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, JwtRefreshAuthGuard } from './guards';
import { LoginAuthDto, RefreshAuthDto, RegisterAuthDto } from '../../dto';
import { UNAUTHORIZED } from '../../helpers/responseHelper';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/v1/login
   * Validates credentials and issues a fresh access + refresh token pair.
   */
  @Post('v1/login')
  async login(@Request() req, @Body() login: LoginAuthDto) {
    const user = await this.authService.validateUser(
      login.username,
      login.password,
    );
    if (!user) {
      throw new UnauthorizedException(
        UNAUTHORIZED(req.i18n.__('invalidusercredentials'), req),
      );
    }
    return this.authService.login(user);
  }

  /**
   * POST /auth/v1/refresh-token
   * Protected by the refresh-token strategy.
   * Re-issues a new token pair using the validated refresh token.
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Post('v1/refresh-token')
  async refreshToken(@Request() req, @Body() _body: RefreshAuthDto) {
    // req.user is populated by RefreshTokenStrategy.validate()
    return this.authService.login(req.user);
  }

  /**
   * POST /auth/v1/logout
   * Protected by the access-token strategy.
   * Purges all Redis sessions for the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Post('v1/logout')
  async logout(@Request() req) {
    await this.authService.logout(req.user.id);
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /auth/v1/register
   */
  @Post('v1/register')
  async register(@Request() req, @Body() register: RegisterAuthDto) {
    return this.authService.register(register);
  }
}
