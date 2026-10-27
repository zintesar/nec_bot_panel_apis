import { Module } from '@nestjs/common';
import { UserTypeService } from './user-type.service';
import { UserTypeController } from './user-type.controller';

@Module({
  providers: [UserTypeService],
  controllers: [UserTypeController]
})
export class UserTypeModule {}
