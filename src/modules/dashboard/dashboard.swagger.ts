import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AgentHeartbeatDto } from '../../dto/dashboard.dto';

/**
 * Swagger documentation decorator for GET dashboard summary
 */
export function ApiDashboardSummaryDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get unified dashboard overview metrics (customer growth, chat pipeline, agent workforce)',
      description:
        'Aggregates key operational indicators: total customers with comparative period growth, real-time chat pipeline status counts, and agent workforce presence breakdown.',
    }),
    ApiResponse({
      status: 200,
      description: 'Dashboard summary retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET customer growth metrics
 */
export function ApiCustomerGrowthDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get customer totals and percentage growth compared to preceding period (1d, 7d, 30d, 1y)',
      description:
        'Calculates total registered customers and percentage change across 1-day, 7-day, 30-day, and 1-year comparative windows.',
    }),
    ApiQuery({
      name: 'period',
      description: 'Comparison period: "1d", "7d", "30d", "1y", or "all"',
      required: false,
      example: 'all',
    }),
    ApiResponse({
      status: 200,
      description: 'Customer growth metrics retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET chat status statistics
 */
export function ApiChatStatusStatsDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get chat activity pipeline status breakdown (waiting=0, AI in progress=2, completed=1, human active=3)',
      description:
        'Returns aggregate counts of chats across each status in the pipeline with optional timeframe filtering.',
    }),
    ApiQuery({
      name: 'timeframe',
      description: 'Timeframe filter: "today", "7d", "30d", or "all"',
      required: false,
      example: 'all',
    }),
    ApiResponse({
      status: 200,
      description: 'Chat status statistics retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET agent activity metrics
 */
export function ApiAgentActivityDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get agent activity roster (presence status, assigned chat, interaction start time, interaction duration)',
      description:
        'Monitors real-time agent presence (online/away/offline), whether currently assigned to a chat, takeover timestamp, and elapsed live interaction duration.',
    }),
    ApiQuery({
      name: 'status',
      description: 'Filter by agent status: "all", "online", "busy", "available", "away", "offline"',
      required: false,
      example: 'all',
    }),
    ApiQuery({
      name: 'search',
      description: 'Search agent name, email, or user ID',
      required: false,
      example: 'agent',
    }),
    ApiResponse({
      status: 200,
      description: 'Agent activity metrics retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for POST agent heartbeat
 */
export function ApiAgentHeartbeatDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Send agent client presence heartbeat',
      description:
        'Records agent presence signal to maintain active online/away state on the supervisor dashboard.',
    }),
    ApiBody({ type: AgentHeartbeatDto }),
    ApiResponse({
      status: 200,
      description: 'Heartbeat recorded successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

