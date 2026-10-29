import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  MinLength,
  IsEmail,
  IsString,
  IsEnum,
} from 'class-validator';

export enum UserType {
  AGENT = 'agent',
  ADMIN = 'admin',
}

export class LoginAuthDto {
  @ApiProperty({
    description: 'Username for user authentication',
    example: 'john_doe',
  })
  @IsNotEmpty()
  readonly username: string;

  @ApiProperty({
    description: 'Password for user authentication',
    example: 'password123',
  })
  @IsNotEmpty()
  readonly password: string;
}

export class RefreshAuthDto {
  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}

export class RegisterAuthDto {
  @ApiProperty({
    description: 'Username for registration',
    example: 'john_doe',
  })
  @IsNotEmpty()
  readonly username: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  readonly email: string;

  @ApiProperty({
    description: 'Password for registration (min 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;

  @ApiProperty({
    description: 'User type for registration',
    enum: UserType,
    enumName: 'UserType',
    example: UserType.AGENT,
  })
  @IsNotEmpty()
  @IsEnum(UserType, {
    message: 'user_type must be either agent or admin',
  })
  readonly user_type: UserType;
}
