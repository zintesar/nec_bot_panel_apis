import { Module } from '@nestjs/common';
import { ChatActivityController } from './chat-activity.controller';
import { ChatActivityService } from './chat-activity.service';
import { ChatBotService } from './chat-bot.service';
import { chatActivityProviders } from './chat-activity.providers';
import { EmailSendModule } from '../email-send/email-send.module';

@Module({
  imports: [EmailSendModule],
  controllers: [ChatActivityController],
  providers: [ChatActivityService, ChatBotService, ...chatActivityProviders],
  exports: [ChatActivityService, ChatBotService],
})
export class ChatActivityModule { }
