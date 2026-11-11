import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

/**
 * Swagger documentation decorator for POST fetch3partyapi
 */
export function ApiFetch3PartyDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Fetch data from third-party integration API' }),
    ApiBody({
      description: 'Request payload for third-party service',
      schema: { type: 'object' },
    }),
    ApiResponse({ status: 200, description: 'Third-party API response retrieved successfully' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET getQuote
 */
export function ApiGetQuoteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Get quotes from external integration service' }),
    ApiResponse({ status: 200, description: 'Quotes fetched successfully' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for POST submitQuote
 */
export function ApiSubmitQuoteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Submit quote to external integration service' }),
    ApiBody({
      description: 'Quote submission payload',
      schema: { type: 'object' },
    }),
    ApiResponse({ status: 200, description: 'Quote submitted successfully' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

