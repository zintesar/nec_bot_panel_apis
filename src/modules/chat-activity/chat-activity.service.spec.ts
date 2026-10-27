import { Test, TestingModule } from '@nestjs/testing';
import { ChatActivityService } from './chat-activity.service';

describe('ChatActivityService', () => {
  let service: ChatActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatActivityService],
    }).compile();

    service = module.get<ChatActivityService>(ChatActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
