import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Swagger documentation decorator for GET customer profile list
 */
export function ApiGetCustomerProfileListDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get paginated customer profile list with stats, status, and last activity',
    }),
    ApiResponse({
      status: 200,
      description: 'Customer profiles retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * Swagger documentation decorator for GET single customer profile
 */
export function ApiGetCustomerProfileByIdDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get single customer profile details and chat activity history by ID/phone/WhatsApp ID',
    }),
    ApiParam({
      name: 'id',
      description: 'Customer UUID, phone number, or WhatsApp ID',
    }),
    ApiResponse({
      status: 200,
      description: 'Customer profile retrieved successfully',
    }),
    ApiResponse({ status: 404, description: 'Customer not found' }),
  );
}

/**
 * Swagger documentation decorator for POST create customer
 */
export function ApiCreateCustomerDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new customer profile' }),
    ApiResponse({ status: 201, description: 'Customer created successfully' }),
  );
}

/**
 * Swagger documentation decorator for PUT update customer
 */
export function ApiUpdateCustomerDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Update customer profile' }),
    ApiParam({ name: 'id', description: 'Customer UUID' }),
    ApiResponse({ status: 200, description: 'Customer updated successfully' }),
  );
}

/**
 * Swagger documentation decorator for DELETE customer
 */
export function ApiDeleteCustomerDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a customer' }),
    ApiParam({ name: 'id', description: 'Customer UUID' }),
    ApiResponse({ status: 200, description: 'Customer deleted successfully' }),
  );
}

