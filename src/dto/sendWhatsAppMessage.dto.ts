import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendWhatsAppTextMessageDto {
  @ApiProperty({
    description: 'WhatsApp number or phone number of the recipient',
    example: '16315551234',
  })
  @IsNotEmpty()
  @IsString()
  whatsapp_number: string;

  @ApiProperty({
    description: 'Text message to send to the recipient',
    example: 'Hello, your appointment has been confirmed.',
  })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Optional alias for whatsapp_number',
    example: '16315551234',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Optional alias for text',
    example: 'Hello, your appointment has been confirmed.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Optional chat activity ID to associate with this message',
    example: '2251d1da-b081-49c2-b17f-e4048442c93e',
  })
  @IsOptional()
  @IsString()
  chat_activity_id?: string;
}

