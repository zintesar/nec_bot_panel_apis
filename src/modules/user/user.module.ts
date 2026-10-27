import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { userProviders } from './user.providers';
import { DatabaseModule } from '../../config/database/database.module';
import { RedisModule } from '../../config/redis/redis.module';

@Module({
  providers: [UserService, ...userProviders],
  imports: [DatabaseModule, RedisModule],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
