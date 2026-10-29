import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MessageTextDto {
  @ApiProperty({
    description: 'Body text of the incoming message',
    example: 'Hello, I would like to inquire about services.',
  })
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class IncomingMessageItemDto {
  @ApiProperty({
    description: 'WhatsApp ID (phone number) of the sender',
    example: '16315551234',
  })
  @IsString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    description: 'Unique message identifier',
    example: 'wamid.HBgLMTYzMTU1NTEyMzRVFQIAEhgg...',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Unix timestamp when message was sent',
    example: '1698567890',
  })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({
    description: 'Message type (e.g. text, interactive, image)',
    example: 'text',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    description: 'Text message payload',
    type: () => MessageTextDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageTextDto)
  text?: MessageTextDto;

  @ApiPropertyOptional({
    description: 'Image message payload',
    type: () => Object,
  })
  @IsOptional()
  image?: any;

  @ApiPropertyOptional({
    description: 'Interactive message response payload',
    type: () => Object,
  })
  @IsOptional()
  interactive?: any;

  @ApiPropertyOptional({
    description: 'Location payload',
    type: () => Object,
  })
  @IsOptional()
  location?: any;

  @ApiPropertyOptional({
    description: 'Quick reply button response payload',
    type: () => Object,
  })
  @IsOptional()
  button?: any;

  @ApiPropertyOptional({
    description: 'Context of the message (e.g. reply context)',
    type: () => Object,
  })
  @IsOptional()
  context?: any;
}

export class ContactProfileDto {
  @ApiPropertyOptional({
    description: 'Profile name of the sender',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class ContactDto {
  @ApiPropertyOptional({
    description: 'Contact profile details',
    type: () => ContactProfileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactProfileDto)
  profile?: ContactProfileDto;

  @ApiProperty({
    description: 'WhatsApp ID of the contact',
    example: '16315551234',
  })
  @IsString()
  @IsNotEmpty()
  wa_id: string;
}

export class ValueMetadataDto {
  @ApiProperty({
    description: 'Display phone number of the business account',
    example: '15550234567',
  })
  @IsString()
  @IsNotEmpty()
  display_phone_number: string;

  @ApiProperty({
    description: 'Phone number ID of the business account',
    example: '1029384756',
  })
  @IsString()
  @IsNotEmpty()
  phone_number_id: string;
}

export class ChangeValueDto {
  @ApiProperty({
    description: 'Messaging service product name',
    example: 'whatsapp',
  })
  @IsString()
  @IsNotEmpty()
  messaging_product: string;

  @ApiProperty({
    description: 'Metadata about the business phone number',
    type: () => ValueMetadataDto,
  })
  @ValidateNested()
  @Type(() => ValueMetadataDto)
  metadata: ValueMetadataDto;

  @ApiPropertyOptional({
    description: 'Array of customer contact details',
    type: () => [ContactDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @ApiPropertyOptional({
    description: 'Array of incoming messages',
    type: () => [IncomingMessageItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomingMessageItemDto)
  messages?: IncomingMessageItemDto[];

  @ApiPropertyOptional({
    description: 'Array of message delivery statuses',
    type: () => [Object],
  })
  @IsOptional()
  @IsArray()
  statuses?: any[];
}

export class ChangeDto {
  @ApiProperty({
    description: 'Event change payload values',
    type: () => ChangeValueDto,
  })
  @ValidateNested()
  @Type(() => ChangeValueDto)
  value: ChangeValueDto;

  @ApiProperty({
    description: 'Field name triggering the webhook notification',
    example: 'messages',
  })
  @IsString()
  @IsNotEmpty()
  field: string;
}

export class EntryDto {
  @ApiProperty({
    description: 'WhatsApp business account ID',
    example: '10987654321',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Array of changes delivered in this webhook entry',
    type: () => [ChangeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes: ChangeDto[];
}

export class IncomingMessageDto {
  @ApiProperty({
    description: 'Top-level webhook object name',
    example: 'whatsapp_business_account',
  })
  @IsString()
  @IsNotEmpty()
  object: string;

  @ApiProperty({
    description: 'Array of webhook entries',
    type: () => [EntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entry: EntryDto[];
}

// Aliases for backward compatibility
export const ChatActivityDto = IncomingMessageDto;
export type ChatActivityDto = IncomingMessageDto;
