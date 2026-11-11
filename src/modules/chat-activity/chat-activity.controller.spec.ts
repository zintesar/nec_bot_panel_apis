import { Test, TestingModule } from '@nestjs/testing';
import { ChatActivityController } from './chat-activity.controller';
import { ChatActivityService } from './chat-activity.service';

describe('ChatActivityController', () => {
  let controller: ChatActivityController;

  const mockChatActivityService = {
    processWhatsAppTextMessage: jest.fn(),
    getChatList: jest.fn(),
    getChatDetails: jest.fn(),
    assignAgent: jest.fn(),
    unassignAgent: jest.fn(),
    sendWhatsAppTextMessage: jest.fn(),
    botLogin: jest.fn(),
    callBotApi: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatActivityController],
      providers: [
        {
          provide: ChatActivityService,
          useValue: mockChatActivityService,
        },
      ],
    }).compile();

    controller = module.get<ChatActivityController>(ChatActivityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate botLogin to ChatActivityService', async () => {
    const mockTokenRes = { token: 'jwt', token_type: 'Bearer', expires_in: 86400 };
    mockChatActivityService.botLogin.mockResolvedValueOnce(mockTokenRes);

    const result = await controller.botLogin({ username: 'user', password: 'pwd' });
    expect(result).toBe(mockTokenRes);
    expect(mockChatActivityService.botLogin).toHaveBeenCalledWith({ username: 'user', password: 'pwd' });
  });
});

