import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BotMessageDto {
  @ApiProperty({
    description: 'Message text from customer to chatbot',
    example: 'customer text here',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Session identifier or conversation ID',
    example: 'your-conversation-id',
  })
  @IsNotEmpty()
  @IsString()
  session_id: string;

  @ApiPropertyOptional({
    description: 'Language code (e.g. "en", "bn")',
    default: 'en',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string = 'en';
}

export class BotMessageResponseDto {
  @ApiProperty({
    description: 'Whether the chatbot responded successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Text answer to send to the customer on WhatsApp',
    example: 'text to send to the customer on WhatsApp',
  })
  answer: string;

  @ApiPropertyOptional({
    description: 'Confidence score (0-100)',
    example: 90,
  })
  confidence?: number;

  @ApiProperty({
    description: 'Session identifier matching the request',
    example: 'your-conversation-id',
  })
  session_id: string;

  @ApiPropertyOptional({
    description: 'Flag indicating whether bot is awaiting app link reply',
    example: false,
  })
  awaiting_app_link_reply?: boolean;

  @ApiPropertyOptional({
    description: 'Flag indicating whether bot is awaiting rate reply',
    example: false,
  })
  awaiting_rate_reply?: boolean;

  @ApiPropertyOptional({
    description: 'Flag indicating whether bot is awaiting transaction reply',
    example: false,
  })
  awaiting_txn_reply?: boolean;

  @ApiPropertyOptional({
    description: 'Language code of the response',
    example: 'en',
  })
  language?: string;

  @ApiPropertyOptional({
    description: 'Speech locale for text-to-speech',
    example: 'en-GB',
  })
  speech_locale?: string;

  @ApiPropertyOptional({
    description: 'Matched FAQ identifier',
    example: null,
    nullable: true,
  })
  faq_id?: string | null;

  @ApiPropertyOptional({
    description: 'Classified intent',
    example: null,
    nullable: true,
  })
  intent?: string | null;

  @ApiPropertyOptional({
    description: 'Source used for response (e.g. "csv", "ai", "flow")',
    example: 'csv',
  })
  decision_source?: string;

  @ApiPropertyOptional({
    description: 'Detected language from customer input',
    example: null,
    nullable: true,
  })
  detected_language?: string | null;

  @ApiPropertyOptional({
    description: 'Optional WhatsApp link or action URL',
    example: null,
    nullable: true,
  })
  whatsapp_url?: string | null;
}

