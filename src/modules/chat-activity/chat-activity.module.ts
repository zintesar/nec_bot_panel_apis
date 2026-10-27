import { Module } from '@nestjs/common';
import { ChatActivityController } from './chat-activity.controller';
import { ChatActivityService } from './chat-activity.service';
import { chatActivityProviders } from './chat-activity.providers';

@Module({
  controllers: [ChatActivityController],
  providers: [ChatActivityService, ...chatActivityProviders]
})
export class ChatActivityModule { }
