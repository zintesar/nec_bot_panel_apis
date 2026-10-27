import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MessageTextDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class IncomingMessageItemDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageTextDto)
  text?: MessageTextDto;

  @IsOptional()
  image?: any;

  @IsOptional()
  interactive?: any;

  @IsOptional()
  location?: any;

  @IsOptional()
  button?: any;

  @IsOptional()
  context?: any;
}

export class ContactProfileDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class ContactDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactProfileDto)
  profile?: ContactProfileDto;

  @IsString()
  @IsNotEmpty()
  wa_id: string;
}

export class ValueMetadataDto {
  @IsString()
  @IsNotEmpty()
  display_phone_number: string;

  @IsString()
  @IsNotEmpty()
  phone_number_id: string;
}

export class ChangeValueDto {
  @IsString()
  @IsNotEmpty()
  messaging_product: string;

  @ValidateNested()
  @Type(() => ValueMetadataDto)
  metadata: ValueMetadataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomingMessageItemDto)
  messages?: IncomingMessageItemDto[];

  @IsOptional()
  @IsArray()
  statuses?: any[];
}

export class ChangeDto {
  @ValidateNested()
  @Type(() => ChangeValueDto)
  value: ChangeValueDto;

  @IsString()
  @IsNotEmpty()
  field: string;
}

export class EntryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes: ChangeDto[];
}

export class IncomingMessageDto {
  @IsString()
  @IsNotEmpty()
  object: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entry: EntryDto[];
}

// Aliases for backward compatibility
export const ChatActivityDto = IncomingMessageDto;
export type ChatActivityDto = IncomingMessageDto;
