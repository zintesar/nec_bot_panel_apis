import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendWhatsAppTextMessageDto {
  @ApiProperty({
    description: 'WhatsApp phone number of the recipient (with country code, e.g. 16315551234)',
    example: '16315551234',
  })
  @IsNotEmpty()
  @IsString()
  whatsapp_number: string;

  @ApiProperty({
    description: 'Text content to send to the recipient',
    example: 'Hello, your appointment has been confirmed.',
  })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Optional chat activity UUID to associate with this message',
    example: '2251d1da-b081-49c2-b17f-e4048442c93e',
  })
  @IsOptional()
  @IsString()
  chat_activity_id?: string;
}


