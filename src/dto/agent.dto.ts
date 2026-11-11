import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AgentProfileQueryDto {
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
    description: 'Search keyword matching agent name, email, phone number, or user ID',
    example: 'agent',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter agents by workload status: "all", "active" (has ongoing chats), "idle" (no active chats)',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

