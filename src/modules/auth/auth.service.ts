import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UserModel } from '@models/index';
import { USER_REPOSITORY } from '@config/constants';
import { REDIS_CONNECTION } from '@config/constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
    @Inject(REDIS_CONNECTION) private readonly redisClient: any,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateJti(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Parse a duration string such as "1h", "15m", "30d" into seconds.
   */
  private parseDurationToSeconds(duration: string): number {
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: "${duration}"`);
    }
    return parseInt(match[1], 10) * units[match[2]];
  }

  // ─── Token Generation ──────────────────────────────────────────────────────

  async generateAccessToken(user: any): Promise<{ token: string; expiresAt: Date }> {
    const jti = this.generateJti();
    const expiration = process.env.TOKEN_EXPIRATION || '1h';
    const ttlSeconds = this.parseDurationToSeconds(expiration);

    const payload = { ...user, user_id: user.id, jti };

    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWTKEY,
      expiresIn: expiration,
    });

    const redisKey = `app_auth:${user.id}:token:${jti}`;
    await this.redisClient.setEx(redisKey, ttlSeconds, JSON.stringify(user));

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { token, expiresAt };
  }

  async generateRefreshToken(user: any): Promise<{ token: string; expiresAt: Date }> {
    const jti = this.generateJti();
    const expiration = process.env.REFRESH_TOKEN_EXPIRATION || '30d';
    const ttlSeconds = this.parseDurationToSeconds(expiration);

    const payload = { ...user, user_id: user.id, jti };

    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_KEY,
      expiresIn: expiration,
    });

    const redisKey = `app_auth:${user.id}:refreshToken:${jti}`;
    await this.redisClient.setEx(redisKey, ttlSeconds, JSON.stringify(user));

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { token, expiresAt };
  }

  // ─── Session Management ────────────────────────────────────────────────────

  async deleteAllUserSessions(userId: string | number): Promise<void> {
    const pattern = `app_auth:${userId}:*`;
    const keys = await this.redisClient.scan(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key: string) => this.redisClient.del(key)));
    }
  }

  async checkTokenInRedis(userId: string | number, jti: string): Promise<any | null> {
    const key = `app_auth:${userId}:token:${jti}`;
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async checkRefreshTokenInRedis(userId: string | number, jti: string): Promise<any | null> {
    const key = `app_auth:${userId}:refreshToken:${jti}`;
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ─── Auth Flow ─────────────────────────────────────────────────────────────

  async validateUser(username: string, password: string) {
    const user = await (this.userRepository as any).findOne({ where: { email: username } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Return a plain object without the password
    const { password: _pw, ...result } = user.get({ plain: true });
    return result;
  }

  public async login(user: any) {
    // Purge existing sessions first
    await this.deleteAllUserSessions(user.id);

    // Issue both tokens in parallel
    const [accessTokenData, refreshTokenData] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user),
    ]);

    return {
      access_token: accessTokenData.token,
      access_token_expires: accessTokenData.expiresAt,
      refresh_token: refreshTokenData.token,
      refresh_token_expires: refreshTokenData.expiresAt,
    };
  }

  public async logout(userId: string | number): Promise<void> {
    await this.deleteAllUserSessions(userId);
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public async register(register: any) {
    const { name, username, email, password } = register;
    const existing = await (this.userRepository as any).findOne({
      where: { email },
    });
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }
    const hashedPassword = await this.hashPassword(password);
    const newUser = await (this.userRepository as any).create({
      name,
      email,
      password: hashedPassword,
    });
    const { password: _pw, ...result } = newUser.get({ plain: true });
    return result;
  }
}
