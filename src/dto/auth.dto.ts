import {
  IsNotEmpty,
  MinLength,
  IsEmail,
  IsEnum,
  isEmpty,
  isBoolean,
  IsString
} from 'class-validator';

export class LoginAuthDto {
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
  readonly password: string;
}

export class RefreshAuthDto {
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}


export class RegisterAuthDto {

  @IsNotEmpty()
  readonly username: string;

  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;
}
