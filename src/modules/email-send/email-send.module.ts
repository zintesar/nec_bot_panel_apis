import { Module } from '@nestjs/common';
import { EmailSendService } from './email-send.service';
import { KafkaModule } from '../../config/kafka/kafka.module';

@Module({
  imports: [KafkaModule],
  providers: [EmailSendService],
  exports: [EmailSendService],
})
export class EmailSendModule {}
