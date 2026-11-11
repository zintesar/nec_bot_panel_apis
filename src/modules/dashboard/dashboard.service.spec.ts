import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import {
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  DATABASE_CONNECTION,
  USER_REPOSITORY,
} from '../../config/constants';

jest.mock('../../config/winstonLog', () => ({
  winstonLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DashboardService', () => {
  let service: DashboardService;

  const mockCustomerRepo = {
    count: jest.fn(),
    findAll: jest.fn(),
  };

  const mockChatActivityRepo = {
    findAll: jest.fn(),
    count: jest.fn(),
  };

  const mockChatRepo = {
    findAll: jest.fn(),
  };

  const mockUserRepo = {
    findAll: jest.fn(),
  };

  const mockDb = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
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

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatDuration', () => {
    it('should format seconds into friendly strings', () => {
      expect(service.formatDuration(45)).toBe('45s');
      expect(service.formatDuration(125)).toBe('2m 05s');
      expect(service.formatDuration(3665)).toBe('1h 01m 05s');
    });
  });

  describe('getCustomerGrowth', () => {
    it('should calculate customer totals and growth percentage across all periods', async () => {
      mockCustomerRepo.count.mockResolvedValue(100);

      const now = Date.now();
      const mockFirstActivities = [
        // 2 customers acquired in last 12 hours (current 1_day)
        { Customer_Id: 'c1', first_interaction: new Date(now - 6 * 3600 * 1000) },
        { Customer_Id: 'c2', first_interaction: new Date(now - 12 * 3600 * 1000) },
        // 1 customer acquired 30 hours ago (previous 1_day)
        { Customer_Id: 'c3', first_interaction: new Date(now - 30 * 3600 * 1000) },
      ];

      mockChatActivityRepo.findAll.mockResolvedValue(mockFirstActivities);

      const result = await service.getCustomerGrowth({ period: 'all' });

      expect(result.success).toBe(true);
      expect(result.data.total_customers).toBe(100);
      expect(result.data.periods['1_day'].current_period_count).toBe(2);
      expect(result.data.periods['1_day'].previous_period_count).toBe(1);
      expect(result.data.periods['1_day'].percentage_change).toBe(100);
      expect(result.data.periods['1_day'].trend).toBe('up');
    });
  });

  describe('getChatStatusStats', () => {
    it('should return chat counts by status (waiting=0, completed=1, AI=2, human active=3)', async () => {
      mockChatActivityRepo.findAll.mockResolvedValue([
        { Status: 0, count: 5 },  // WAITING
        { Status: 1, count: 90 }, // RESOLVED
        { Status: 2, count: 12 }, // AI_ACTIVE
        { Status: 3, count: 3 },  // HUMAN_ACTIVE
      ]);

      const result = await service.getChatStatusStats({ timeframe: 'all' });

      expect(result.success).toBe(true);
      expect(result.data.status_counts.waiting).toBe(5);
      expect(result.data.status_counts.completed).toBe(90);
      expect(result.data.status_counts.ai_in_progress).toBe(12);
      expect(result.data.status_counts.human_active).toBe(3);
      expect(result.data.total_chats).toBe(110);
      expect(result.data.resolution_rate_percent).toBe(81.82);
    });
  });

  describe('getAgentActivity', () => {
    it('should return agent roster with active assignment, takeover start time, and live interaction duration', async () => {
      const mockAgents = [
        {
          Id: 'agent-1',
          User_Id: 'AGENT01',
          Name: 'Jane Agent',
          Email: 'jane@example.com',
          Phone_Number: '+1234567890',
        },
        {
          Id: 'agent-2',
          User_Id: 'AGENT02',
          Name: 'Bob Agent',
          Email: 'bob@example.com',
          Phone_Number: '+1987654321',
        },
      ];

      mockUserRepo.findAll.mockResolvedValue(mockAgents);

      const takeoverDate = new Date(Date.now() - 300 * 1000); // 5 minutes ago
      mockChatActivityRepo.findAll
        // First call: active chats (Status = 3)
        .mockResolvedValueOnce([
          {
            Activity_Id: 'act-1',
            Agent_Id: 'agent-1',
            Status: 3,
            Started_At: new Date(Date.now() - 600 * 1000),
            Human_Takeover_At: takeoverDate,
            customer: {
              Id: 'cust-1',
              Name: 'Alice Customer',
              Phone_Number: '+1122334455',
            },
          },
        ])
        // Second call: historical totals
        .mockResolvedValueOnce([
          { Agent_Id: 'agent-1', Status: 1, Human_Takeover_At: takeoverDate },
          { Agent_Id: 'agent-1', Status: 3, Human_Takeover_At: takeoverDate },
        ]);

      const result = await service.getAgentActivity({ status: 'all' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const agent1 = result.data.find((a: any) => a.agent.user_id === 'AGENT01');
      expect(agent1.presence.status).toBe('online');
      expect(agent1.presence.sub_status).toBe('busy');
      expect(agent1.chat_status.is_actively_assigned).toBe(true);
      expect(agent1.chat_status.current_interaction.customer.name).toBe('Alice Customer');
      expect(agent1.chat_status.current_interaction.interaction_duration.seconds).toBeGreaterThanOrEqual(299);

      const agent2 = result.data.find((a: any) => a.agent.user_id === 'AGENT02');
      expect(agent2.chat_status.is_actively_assigned).toBe(false);
      expect(agent2.presence.status).toBe('offline');

      expect(result.summary.total_agents).toBe(2);
      expect(result.summary.busy_count).toBe(1);
    });
  });

  describe('recordAgentHeartbeat', () => {
    it('should record heartbeat in memory', async () => {
      const result = await service.recordAgentHeartbeat('agent-1', { status: 'online' });
      expect(result.success).toBe(true);
      expect(result.data.agent_id).toBe('agent-1');
      expect(result.data.status).toBe('online');
    });
  });

  describe('getDashboardSummary', () => {
    it('should return combined metrics for all dashboard cards', async () => {
      mockCustomerRepo.count.mockResolvedValue(50);
      mockChatActivityRepo.findAll
        .mockResolvedValueOnce([]) // growth
        .mockResolvedValueOnce([]) // chat stats
        .mockResolvedValueOnce([]) // agent active chats
        .mockResolvedValueOnce([]); // agent history

      mockUserRepo.findAll.mockResolvedValue([]);

      const result = await service.getDashboardSummary();
      expect(result.success).toBe(true);
      expect(result.data.customers).toBeDefined();
      expect(result.data.chat_pipeline).toBeDefined();
      expect(result.data.agents_summary).toBeDefined();
    });
  });
});
