import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatActivityService } from './chat-activity.service';
import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, USER_REPOSITORY } from '@config/constants';
import axios from 'axios';

jest.mock('axios');
jest.mock('@config/winstonLog', () => ({
  winstonLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatActivityService - sendWhatsAppTextMessage', () => {
  let service: ChatActivityService;

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockChatActivityRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockChatRepo = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.WHATSAPP_ACCESS_TOKEN = 'test_token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatActivityService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepo,
        },
        {
          provide: CHAT_ACTIVITY_REPOSITORY,
          useValue: mockChatActivityRepo,
        },
        {
          provide: CHAT_REPOSITORY,
          useValue: mockChatRepo,
        },
      ],
    }).compile();

    service = module.get<ChatActivityService>(ChatActivityService);
  });

  it('should throw BadRequestException if whatsapp_number is missing', async () => {
    await expect(
      service.sendWhatsAppTextMessage({
        whatsapp_number: '',
        text: 'hello',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if text is missing', async () => {
    await expect(
      service.sendWhatsAppTextMessage({
        whatsapp_number: '16315551234',
        text: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if user is not found in user table', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      service.sendWhatsAppTextMessage({
        whatsapp_number: '16315551234',
        text: 'hello',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should successfully send message when user exists and return result', async () => {
    const mockUser = {
      Id: '62352ff5-b6b4-4131-8f15-fce693cb2f33',
      Name: 'John Doe',
      Phone_Number: '16315551234',
      WhatsApp_Id: 16315551234,
    };

    mockUserRepo.findOne.mockResolvedValue(mockUser);
    mockChatActivityRepo.findOne.mockResolvedValue({
      Activity_Id: '2251d1da-b081-49c2-b17f-e4048442c93e',
      Customer_Id: '62352ff5-b6b4-4131-8f15-fce693cb2f33',
      Agent_Id: null,
    });
    mockChatRepo.create.mockResolvedValue({ Id: 'chat-uuid-1' });

    mockedAxios.post.mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '16315551234', wa_id: '16315551234' }],
        messages: [{ id: 'wamid.HBgL...' }],
      },
    } as any);

    const result = await service.sendWhatsAppTextMessage({
      whatsapp_number: '16315551234',
      text: 'Order confirmed',
    });

    expect(result.success).toBe(true);
    expect(result.data.messageId).toBe('wamid.HBgL...');
    expect(result.data.recipient.whatsAppId).toBe('16315551234');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('123456789/messages'),
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '16315551234',
        type: 'text',
        text: {
          preview_url: false,
          body: 'Order confirmed',
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test_token',
        }),
      }),
    );
    expect(mockChatRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        From: '123456789',
        To: '16315551234',
        Content: 'Order confirmed',
        Type: 'text',
      }),
    );
  });
});
