import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

/**
 * Swagger documentation decorator for POST login
 */
export function ApiLoginDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Login user and obtain access/refresh tokens' }),
    ApiResponse({ status: 200, description: 'User authenticated successfully' }),
    ApiResponse({ status: 401, description: 'Invalid user credentials' }),
  );
}

/**
 * Swagger documentation decorator for POST refresh-token
 */
export function ApiRefreshTokenDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Refresh access token using refresh token' }),
    ApiResponse({ status: 200, description: 'Tokens re-issued successfully' }),
    ApiResponse({ status: 401, description: 'Invalid or expired refresh token' }),
  );
}

/**
 * Swagger documentation decorator for POST logout
 */
export function ApiLogoutDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Logout user and invalidate sessions' }),
    ApiBearerAuth(),
    ApiResponse({ status: 200, description: 'Logged out successfully' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for POST register
 */
export function ApiRegisterDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Register a new user' }),
    ApiResponse({ status: 201, description: 'User registered successfully' }),
    ApiResponse({ status: 401, description: 'User already exists' }),
  );
}

