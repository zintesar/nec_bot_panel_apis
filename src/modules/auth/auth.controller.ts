import {
  Controller,
  Body,
  Post,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard, JwtRefreshAuthGuard } from './guards';
import { LoginAuthDto, RefreshAuthDto, RegisterAuthDto } from '../../dto';
import { UNAUTHORIZED } from '../../helpers/responseHelper';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/v1/login
   * Validates credentials and issues a fresh access + refresh token pair.
   */
  @ApiOperation({ summary: 'Login user and obtain access/refresh tokens' })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid user credentials' })
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
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens re-issued successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
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
  @ApiOperation({ summary: 'Logout user and invalidate sessions' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('v1/logout')
  async logout(@Request() req) {
    await this.authService.logout(req.user.id);
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /auth/v1/register
   */
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 401, description: 'User already exists' })
  @Post('v1/register')
  async register(@Request() req, @Body() register: RegisterAuthDto) {
    return this.authService.register(register);
  }
}
