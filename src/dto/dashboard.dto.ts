import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CustomerGrowthQueryDto {
  @ApiPropertyOptional({
    description: 'Period for comparison: "1d", "7d", "30d", "1y", or "all"',
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  period?: string = 'all';
}

export class ChatStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Timeframe for chat activity stats: "today", "7d", "30d", or "all"',
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  timeframe?: string = 'all';
}

export class AgentActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by agent presence/workload status: "all", "online", "busy", "available", "away", "offline"',
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  status?: string = 'all';

  @ApiPropertyOptional({
    description: 'Search keyword matching agent name, email, or user ID',
    example: 'agent',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AgentHeartbeatDto {
  @ApiPropertyOptional({
    description: 'Explicit presence status reported by agent client: "online", "away", or "offline"',
    default: 'online',
    example: 'online',
  })
  @IsOptional()
  @IsString()
  status?: string = 'online';
}

