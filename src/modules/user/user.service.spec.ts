import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import {
  CHAT_ACTIVITY_REPOSITORY,
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

describe('UserService - Agent Profiles', () => {
  let service: UserService;

  const mockUserRepo = {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };

  const mockChatActivityRepo = {
    findAll: jest.fn(),
  };

  const mockCustomerRepo = {
    findAll: jest.fn(),
  };

  const mockDb = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepo,
        },
        {
          provide: CHAT_ACTIVITY_REPOSITORY,
          useValue: mockChatActivityRepo,
        },
        {
          provide: CUSTOMER_REPOSITORY,
          useValue: mockCustomerRepo,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAgentProfileList', () => {
    it('should return empty list when no agents exist', async () => {
      mockUserRepo.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      const result = await service.getAgentProfileList({
        page: 1,
        limit: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return populated agent profile list with workload stats and latest activity', async () => {
      const mockAgents = [
        {
          Id: 'agent-1',
          User_Id: 'AGENT01',
          Name: 'Agent Smith',
          Email: 'smith@example.com',
          User_Type: 'agent',
          Phone_Number: '+1234567890',
          WhatsApp_Id: 1234567890,
        },
      ];

      mockUserRepo.findAndCountAll.mockResolvedValue({
        rows: mockAgents,
        count: 1,
      });

      mockChatActivityRepo.findAll.mockResolvedValue([
        {
          Activity_Id: 'act-1',
          Customer_Id: 'cust-1',
          Agent_Id: 'agent-1',
          Status: 3, // HUMAN_ACTIVE
          Started_At: new Date('2026-11-09T11:00:00Z'),
          Human_Takeover_At: new Date('2026-11-09T11:05:00Z'),
          customer: {
            Id: 'cust-1',
            Name: 'Alice Customer',
            Phone_Number: '+1987654321',
          },
        },
      ]);

      const result = await service.getAgentProfileList({
        page: 1,
        limit: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('agent-1');
      expect(result.data[0].user_id).toBe('AGENT01');
      expect(result.data[0].name).toBe('Agent Smith');
      expect(result.data[0].workload_status).toBe('busy');
      expect(result.data[0].stats.total_chats).toBe(1);
      expect(result.data[0].stats.active_chats).toBe(1);
      expect(result.data[0].stats.resolved_chats).toBe(0);
      expect(result.data[0].latest_activity.customer.name).toBe('Alice Customer');
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getAgentProfileById', () => {
    it('should throw NotFoundException when agent does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.getAgentProfileById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return agent profile by UUID or User_Id with chat activity breakdown', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        Id: 'agent-1',
        User_Id: 'AGENT01',
        Name: 'Agent Smith',
        Email: 'smith@example.com',
        User_Type: 'agent',
        Phone_Number: '+1234567890',
        WhatsApp_Id: 1234567890,
      });

      mockChatActivityRepo.findAll.mockResolvedValue([
        {
          Activity_Id: 'act-1',
          Agent_Id: 'agent-1',
          Status: 3,
          Started_At: new Date('2026-11-09T11:00:00Z'),
          customer: {
            Id: 'cust-1',
            Name: 'Alice',
          },
        },
        {
          Activity_Id: 'act-2',
          Agent_Id: 'agent-1',
          Status: 1,
          Started_At: new Date('2026-11-09T09:00:00Z'),
          customer: {
            Id: 'cust-2',
            Name: 'Bob',
          },
        },
      ]);

      const result = await service.getAgentProfileById('AGENT01');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('agent-1');
      expect(result.data.stats.total_chats).toBe(2);
      expect(result.data.stats.active_chats).toBe(1);
      expect(result.data.stats.resolved_chats).toBe(1);
      expect(result.data.active_chats).toHaveLength(1);
      expect(result.data.recent_resolved_chats).toHaveLength(1);
    });
  });
});

