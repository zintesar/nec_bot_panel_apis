import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Swagger documentation decorator for GET agent profile list
 */
export function ApiGetAgentProfileListDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get paginated agent profile list with workload stats and latest chat activity',
    }),
    ApiResponse({
      status: 200,
      description: 'Agent profile list retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET single agent profile
 */
export function ApiGetAgentProfileByIdDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get single agent profile with active and recent chats by UUID or User_Id',
    }),
    ApiParam({
      name: 'id',
      description: 'Agent UUID or User_Id (e.g. AGENT01)',
    }),
    ApiResponse({
      status: 200,
      description: 'Agent profile retrieved successfully',
    }),
    ApiResponse({ status: 404, description: 'Agent not found' }),
  );
}

