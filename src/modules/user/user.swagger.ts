import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserDto } from '../../dto';

/**
 * Swagger documentation decorator for POST create user
 */
export function ApiUserCreateDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new user' }),
    ApiBody({ type: UserDto }),
    ApiResponse({ status: 201, description: 'User created successfully' }),
  );
}

/**
 * Swagger documentation decorator for PUT update user
 */
export function ApiUserEditDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Update user by ID' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiBody({ type: UserDto }),
    ApiResponse({ status: 200, description: 'User updated successfully' }),
  );
}

/**
 * Swagger documentation decorator for DELETE user
 */
export function ApiUserDeleteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete user by ID' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({ status: 200, description: 'User deleted successfully' }),
  );
}

/**
 * Swagger documentation decorator for GET all users
 */
export function ApiUserListDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Get list of all users' }),
    ApiResponse({ status: 200, description: 'User list retrieved successfully' }),
  );
}

/**
 * Swagger documentation decorator for GET agent profile list in UserController
 */
export function ApiUserAgentProfileListDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get paginated agent profile list with workload stats and latest chat activity',
    }),
    ApiBearerAuth(),
    ApiResponse({ status: 200, description: 'Agent profile list retrieved successfully' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET single agent profile in UserController
 */
export function ApiUserAgentProfileByIdDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get single agent profile with active and recent chats by UUID or User_Id',
    }),
    ApiParam({ name: 'id', description: 'Agent UUID or User_Id' }),
    ApiBearerAuth(),
    ApiResponse({ status: 200, description: 'Agent profile retrieved successfully' }),
    ApiResponse({ status: 404, description: 'Agent not found' }),
  );
}

/**
 * Swagger documentation decorator for GET user activities
 */
export function ApiUserActivityDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all agents with their chat activities' }),
    ApiResponse({ status: 200, description: 'Agent activities retrieved successfully' }),
  );
}

/**
 * Swagger documentation decorator for GET user by ID
 */
export function ApiUserFindByIdDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Find user by ID' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({ status: 200, description: 'User found successfully' }),
    ApiResponse({ status: 404, description: 'User not found' }),
  );
}

