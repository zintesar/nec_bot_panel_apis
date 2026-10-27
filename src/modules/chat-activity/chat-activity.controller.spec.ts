import { Test, TestingModule } from '@nestjs/testing';
import { ChatActivityController } from './chat-activity.controller';

describe('ChatActivityController', () => {
  let controller: ChatActivityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatActivityController],
    }).compile();

    controller = module.get<ChatActivityController>(ChatActivityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
