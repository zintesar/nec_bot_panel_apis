import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Op } from 'sequelize';
import { UserModel } from '@models/index';
import { USER_REPOSITORY } from '@config/constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
  ) { }

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
    const userId = user.id || user.Id || user.user_id;
    const jti = this.generateJti();
    const expiration = process.env.TOKEN_EXPIRATION || '15m';
    const ttlSeconds = this.parseDurationToSeconds(expiration);
    const tokenVersion = user.Token_Version ?? user.token_version ?? 1;

    const payload = {
      ...user,
      id: userId,
      user_id: userId,
      token_version: tokenVersion,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWTKEY,
      expiresIn: expiration,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { token, expiresAt };
  }

  async generateRefreshToken(user: any): Promise<{ token: string; expiresAt: Date }> {
    const userId = user.id || user.Id || user.user_id;
    const jti = this.generateJti();
    const expiration = process.env.REFRESH_TOKEN_EXPIRATION || '30d';
    const ttlSeconds = this.parseDurationToSeconds(expiration);
    const tokenVersion = user.Token_Version ?? user.token_version ?? 1;

    const payload = {
      ...user,
      id: userId,
      user_id: userId,
      token_version: tokenVersion,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_KEY,
      expiresIn: expiration,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { token, expiresAt };
  }

  // ─── Session Management ────────────────────────────────────────────────────

  async deleteAllUserSessions(_userId: string | number): Promise<void> {
    // Stateless auth: No persistent server-side sessions to purge
  }

  // ─── Auth Flow ─────────────────────────────────────────────────────────────

  async validateUser(username: string, password: string) {
    let user = await (this.userRepository as any).findOne({ where: { Name: username } });
    if (!user) {
      user = await (this.userRepository as any).findOne({ where: { Email: username } });
    }

    if (!user) {
      return null;
    }

    const hashedPassword = user.Password || user.password;
    if (!hashedPassword) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, hashedPassword);
    if (!isPasswordValid) {
      return null;
    }

    // Return a plain object without the password
    const plainUser = user.get({ plain: true });
    const { password: _pw, Password: _pw2, ...result } = plainUser;
    const userId = plainUser.id || plainUser.Id;
    return {
      ...result,
    };
  }

  public async login(user: any) {
    // Issue both tokens in parallel
    const [accessTokenData, refreshTokenData] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user),
    ]);

    return {
      user: user,
      access_token: accessTokenData.token,
      access_token_expires: accessTokenData.expiresAt,
      refresh_token: refreshTokenData.token,
      refresh_token_expires: refreshTokenData.expiresAt,
    };
  }

  public async logout(userId: string | number): Promise<void> {
    // Invalidate existing sessions by incrementing the token version in the database
    if (userId) {
      await (this.userRepository as any).increment('Token_Version', {
        where: { Id: userId },
      });
    }
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public async register(register: any) {
    const { name, username, email, password, user_type } = register;
    const existing = await (this.userRepository as any).findOne({
      where: { Email: email },
    }, { logging: console.log });
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }
    const hashedPassword = await this.hashPassword(password);

    //generate user id
    const roleType = (user_type || '').toLowerCase() === 'admin' ? 'ADMIN' : 'AGENT';
    const prefix = `NEC-${roleType}-`;

    const lastUser = await (this.userRepository as any).findOne({
      where: {
        User_Id: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['User_Id', 'DESC']],
    });

    let nextNumber = 1;
    if (lastUser?.User_Id) {
      const match = lastUser.User_Id.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`));
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const generatedUserId = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    const entry_data = {
      Name: username,
      Password: hashedPassword,
      Email: email,
      User_Type: user_type,
      User_Id: generatedUserId,
    };
    console.log("🚀 ~ AuthService ~ register ~ entry_data:", entry_data)

    const newUser = await this.userRepository.create(entry_data, { logging: console.log });
    console.log("🚀 ~ AuthService ~ register ~ newUser:", newUser)
    const plainUser = newUser.get({ plain: true });
    const { password: _pw, Password: _pw2, ...result } = plainUser;
    const userId = plainUser.id || plainUser.Id;
    const userData = {
      ...result,
      id: userId,
      user_id: userId,
    };

    const tokens = await this.login(userData);

    return {
      ...userData,
      token: tokens.access_token,
      ...tokens,
    };
  }
}
