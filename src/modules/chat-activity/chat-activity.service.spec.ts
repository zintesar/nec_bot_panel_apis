import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatActivityService } from './chat-activity.service';
import { ChatBotService } from './chat-bot.service';
import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, CUSTOMER_REPOSITORY, USER_REPOSITORY } from '@config/constants';
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
    findAll: jest.fn(),
    count: jest.fn(),
  };

  const mockChatRepo = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  const mockCustomerRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockChatBotService = {
    callBotApi: jest.fn(),
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
        {
          provide: CUSTOMER_REPOSITORY,
          useValue: mockCustomerRepo,
        },
        {
          provide: ChatBotService,
          useValue: mockChatBotService,
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

  it('should successfully send message when customer exists in customerRepository', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    const mockCustomer = {
      Id: 'cust-uuid-1',
      Name: 'Jane Customer',
      Phone_Number: '8801700000000',
      WhatsApp_Id: 8801700000000,
    };
    mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
    mockChatActivityRepo.findOne.mockResolvedValue({
      Activity_Id: 'act-uuid-1',
      Customer_Id: 'cust-uuid-1',
    });
    mockChatRepo.create.mockResolvedValue({ Id: 'chat-uuid-2' });

    mockedAxios.post.mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '8801700000000', wa_id: '8801700000000' }],
        messages: [{ id: 'wamid.CUST...' }],
      },
    } as any);

    const result = await service.sendWhatsAppTextMessage({
      whatsapp_number: '8801700000000',
      text: 'Hello from customer lookup',
    });

    expect(result.success).toBe(true);
    expect(result.data.recipient.userId).toBe('cust-uuid-1');
  });

  describe('processWhatsAppTextMessage', () => {
    it('should take incoming text, call bot API, extract answer, and send to WhatsApp', async () => {
      const mockCustomer = {
        Id: 'cust-uuid-123',
        Name: 'Alice',
        Phone_Number: '8801812345678',
        WhatsApp_Id: 8801812345678,
      };
      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockChatActivityRepo.findOne.mockResolvedValue({
        Activity_Id: 'session-activity-999',
        Customer_Id: 'cust-uuid-123',
        Status: 0,
        save: jest.fn().mockResolvedValue(true),
      });
      mockChatRepo.create.mockResolvedValue({ Id: 'chat-entry-1' });

      // Mock bot API reply
      const mockBotReply = {
        success: true,
        answer: 'Hello Alice, how can I help you today?',
        confidence: 95,
        session_id: 'session-activity-999',
      };
      mockChatBotService.callBotApi.mockResolvedValue(mockBotReply);

      // Spy on sendWhatsAppTextMessage
      const sendSpy = jest.spyOn(service, 'sendWhatsAppTextMessage').mockResolvedValue({
        success: true,
        messageId: 'wamid.OUTBOUND123',
      } as any);

      const incomingMsg = {
        sender: '8801812345678',
        body: 'Hello',
        messageId: 'wamid.INCOMING123',
        timestamp: '1700000000',
        type: 'text',
        name: 'Alice',
      };

      const result = await service.processWhatsAppTextMessage(incomingMsg);

      // Verify incoming chat was saved
      expect(mockChatRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          Activity_Id: 'session-activity-999',
          Content: 'Hello',
          Message_Id: 'wamid.INCOMING123',
        }),
      );

      // Verify bot API was called with text and session_id
      expect(mockChatBotService.callBotApi).toHaveBeenCalledWith({
        message: 'Hello',
        session_id: 'session-activity-999',
        language: 'en',
      });

      // Verify sendWhatsAppTextMessage was dispatched with bot answer
      expect(sendSpy).toHaveBeenCalledWith({
        whatsapp_number: '8801812345678',
        text: 'Hello Alice, how can I help you today?',
        chat_activity_id: 'session-activity-999',
      });

      expect(result.botResponse).toEqual(mockBotReply);
    });

    it('should ignore message echoes and not trigger bot or outbound send', async () => {
      mockCustomerRepo.findOne.mockResolvedValue({ Id: 'cust-1' });
      mockChatActivityRepo.findOne.mockResolvedValue({ Activity_Id: 'act-1' });
      mockChatRepo.create.mockResolvedValue({ Id: 'echo-entry-1' });

      const sendSpy = jest.spyOn(service, 'sendWhatsAppTextMessage');

      const echoMsg = {
        sender: '8801812345678',
        body: 'Echo text from business',
        messageId: 'wamid.ECHO123',
        timestamp: '1700000000',
        type: 'text',
        isEcho: true,
      };

      const result = await service.processWhatsAppTextMessage(echoMsg);

      expect(mockChatBotService.callBotApi).not.toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
      expect(result.incomingChat).toBeDefined();
    });

    it('should not dispatch WhatsApp message if bot returns no answer', async () => {
      mockCustomerRepo.findOne.mockResolvedValue({ Id: 'cust-1' });
      mockChatActivityRepo.findOne.mockResolvedValue({ Activity_Id: 'act-1', save: jest.fn() });
      mockChatRepo.create.mockResolvedValue({ Id: 'chat-1' });

      mockChatBotService.callBotApi.mockResolvedValue({
        success: false,
        answer: null,
      });

      const sendSpy = jest.spyOn(service, 'sendWhatsAppTextMessage');

      const incomingMsg = {
        sender: '8801812345678',
        body: 'Unknown query',
        messageId: 'wamid.IN123',
        timestamp: '1700000000',
        type: 'text',
      };

      await service.processWhatsAppTextMessage(incomingMsg);

      expect(mockChatBotService.callBotApi).toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('getChatList', () => {
    it('should return paginated activities with only the last 1 chat for each activity', async () => {
      const mockActivities = [
        {
          Activity_Id: 'act-101',
          Customer_Id: 'cust-1',
          Status: 0,
          toJSON: () => ({ Activity_Id: 'act-101', Customer_Id: 'cust-1', Status: 0 }),
        },
        {
          Activity_Id: 'act-102',
          Customer_Id: 'cust-2',
          Status: 2,
          toJSON: () => ({ Activity_Id: 'act-102', Customer_Id: 'cust-2', Status: 2 }),
        },
      ];

      mockChatActivityRepo.findAll = jest.fn().mockResolvedValue(mockActivities);
      mockChatActivityRepo.count = jest.fn().mockResolvedValue(2);

      const mockChats = [
        { Id: 'chat-newest-1', Activity_Id: 'act-101', Content: 'Latest message for act 101', Timestamp: new Date('2026-11-11T12:00:00Z') },
        { Id: 'chat-older-1', Activity_Id: 'act-101', Content: 'Older message for act 101', Timestamp: new Date('2026-11-11T11:00:00Z') },
        { Id: 'chat-newest-2', Activity_Id: 'act-102', Content: 'Latest message for act 102', Timestamp: new Date('2026-11-11T12:30:00Z') },
      ];

      mockChatRepo.findAll = jest.fn().mockResolvedValue(mockChats);

      const result = await service.getChatList(1, 10, 'waiting');

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);

      // Verify act-101 received only its latest message
      expect(result.data[0].last_chat.Id).toBe('chat-newest-1');

      // Verify act-102 received only its latest message
      expect(result.data[1].last_chat.Id).toBe('chat-newest-2');

      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
      });
    });
  });

  describe('setPriority', () => {
    it('should successfully update priority for an existing chat activity', async () => {
      const mockActivity = {
        Activity_Id: 'act-uuid-1',
        Priority: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      mockChatActivityRepo.findOne.mockResolvedValueOnce(mockActivity);

      const result = await service.setPriority({
        activity_id: 'act-uuid-1',
        priority: 3,
      });

      expect(mockChatActivityRepo.findOne).toHaveBeenCalledWith({
        where: { Activity_Id: 'act-uuid-1' },
      });
      expect(mockActivity.Priority).toBe(3);
      expect(mockActivity.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.Priority).toBe(3);
    });

    it('should throw NotFoundException if chat activity does not exist', async () => {
      mockChatActivityRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.setPriority({
          activity_id: 'non-existent',
          priority: 2,
        }),
      ).rejects.toThrow('Chat activity not found for UUID: non-existent');
    });

    it('should throw BadRequestException if activity UUID is missing', async () => {
      await expect(
        service.setPriority({
          activity_id: '',
          priority: 2,
        }),
      ).rejects.toThrow('Activity UUID is required');
    });

    it('should throw BadRequestException if priority is missing or not a number', async () => {
      await expect(
        service.setPriority({
          activity_id: 'act-1',
          priority: null as any,
        }),
      ).rejects.toThrow('Valid integer priority is required');
    });
  });
});
