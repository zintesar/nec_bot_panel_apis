import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import {
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  DATABASE_CONNECTION,
  USER_REPOSITORY,
} from '../../config/constants';
import { NotFoundException } from '@nestjs/common';

jest.mock('../../config/winstonLog', () => ({
  winstonLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CustomerService', () => {
  let service: CustomerService;

  const mockCustomerRepo = {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  };

  const mockChatActivityRepo = {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockChatRepo = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDb = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: CUSTOMER_REPOSITORY,
          useValue: mockCustomerRepo,
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
          provide: USER_REPOSITORY,
          useValue: mockUserRepo,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCustomerProfileList', () => {
    it('should return empty list when no customers exist', async () => {
      mockCustomerRepo.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      const result = await service.getCustomerProfileList({
        page: 1,
        limit: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return populated customer profile list with stats and latest message', async () => {
      const mockCustomers = [
        {
          Id: 'cust-1',
          Name: 'Alice Customer',
          Phone_Number: '+1234567890',
          WhatsApp_Id: 1234567890,
        },
      ];

      mockCustomerRepo.findAndCountAll.mockResolvedValue({
        rows: mockCustomers,
        count: 1,
      });

      mockChatActivityRepo.findAll.mockResolvedValue([
        {
          Activity_Id: 'act-1',
          Customer_Id: 'cust-1',
          Agent_Id: 'agent-1',
          Status: 3, // HUMAN_ACTIVE
          Started_At: new Date('2026-11-09T10:00:00Z'),
          Human_Takeover_At: new Date('2026-11-09T10:05:00Z'),
          agent: {
            Id: 'agent-1',
            User_Id: 'AGENT01',
            Name: 'Bob Agent',
            Email: 'bob@example.com',
          },
        },
      ]);

      mockChatRepo.findAll.mockResolvedValue([
        {
          Id: 'chat-1',
          Activity_Id: 'act-1',
          Message_Id: 'msg-1',
          Content: 'Hello support',
          Type: 'text',
          Timestamp: new Date('2026-11-09T10:01:00Z'),
          From: '+1234567890',
          To: 'bot',
        },
      ]);

      const result = await service.getCustomerProfileList({
        page: 1,
        limit: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('cust-1');
      expect(result.data[0].name).toBe('Alice Customer');
      expect(result.data[0].stats.total_chats).toBe(1);
      expect(result.data[0].stats.active_chats).toBe(1);
      expect(result.data[0].stats.resolved_chats).toBe(0);
      expect(result.data[0].current_status).toBe('human_active');
      expect(result.data[0].latest_activity.agent.name).toBe('Bob Agent');
      expect(result.data[0].last_message.content).toBe('Hello support');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('getCustomerProfileById', () => {
    it('should throw NotFoundException when customer does not exist', async () => {
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(service.getCustomerProfileById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return complete customer profile with activities when customer exists', async () => {
      mockCustomerRepo.findOne.mockResolvedValue({
        Id: 'cust-1',
        Name: 'Alice Customer',
        Phone_Number: '+1234567890',
        WhatsApp_Id: 1234567890,
      });

      mockChatActivityRepo.findAll.mockResolvedValue([
        {
          Activity_Id: 'act-1',
          Customer_Id: 'cust-1',
          Status: 1, // RESOLVED
          Started_At: new Date('2026-11-09T08:00:00Z'),
          chats: [
            {
              Message_Id: 'm1',
              Content: 'Resolved query',
            },
          ],
        },
      ]);

      const result = await service.getCustomerProfileById('cust-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('cust-1');
      expect(result.data.stats.total_chats).toBe(1);
      expect(result.data.stats.resolved_chats).toBe(1);
      expect(result.data.activities).toHaveLength(1);
    });
  });
});

