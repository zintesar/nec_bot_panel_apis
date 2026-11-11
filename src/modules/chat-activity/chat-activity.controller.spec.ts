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
    setPriority: jest.fn(),
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

  it('should delegate setPriority to ChatActivityService', async () => {
    const mockRes = { success: true, message: 'Priority updated successfully' };
    mockChatActivityService.setPriority.mockResolvedValueOnce(mockRes);

    const dto = { activity_id: 'act-uuid-1', priority: 3 };
    const result = await controller.setPriority(dto);
    expect(result).toBe(mockRes);
    expect(mockChatActivityService.setPriority).toHaveBeenCalledWith(dto);
  });
});

