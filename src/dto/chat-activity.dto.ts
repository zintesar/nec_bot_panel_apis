import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SetPriorityDto {
  @ApiProperty({
    description: 'Chat activity UUID',
    example: '62352FF5-B6B4-4131-8F15-FCE693CB2F33',
  })
  @IsNotEmpty()
  @IsString()
  readonly activity_id: string;

  @ApiProperty({
    description: 'Priority level (1 = Low, 2 = Medium, 3 = High, 4 = Urgent)',
    example: 2,
    minimum: 1,
    maximum: 4,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  readonly priority: number;
}

