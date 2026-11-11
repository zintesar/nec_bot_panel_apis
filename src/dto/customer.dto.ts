import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CustomerProfileQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination (minimum 1)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  page?: number | string = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (minimum 1, maximum 100)',
    default: 15,
    example: 15,
  })
  @IsOptional()
  limit?: number | string = 15;

  @ApiPropertyOptional({
    description: 'Search keyword matching customer name, phone number, or WhatsApp ID',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by chat status: "all", "waiting", "resolved", "ai_active", "human_active", "active"',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer full name',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Customer phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Customer WhatsApp ID (numeric string or number)',
    example: '1234567890',
  })
  @IsOptional()
  whatsapp_id?: number | string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({
    description: 'Customer full name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Customer phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Customer WhatsApp ID',
    example: '1234567890',
  })
  @IsOptional()
  whatsapp_id?: number | string;
}

