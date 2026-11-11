import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User Type')
@Controller('user-type')
export class UserTypeController {}
