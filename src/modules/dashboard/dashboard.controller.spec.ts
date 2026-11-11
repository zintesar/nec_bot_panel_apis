import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockDashboardService = {
    getDashboardSummary: jest.fn(),
    getCustomerGrowth: jest.fn(),
    getChatStatusStats: jest.fn(),
    getAgentActivity: jest.fn(),
    recordAgentHeartbeat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate getDashboardSummary to service', async () => {
    const mockSummary = { success: true, data: {} };
    mockDashboardService.getDashboardSummary.mockResolvedValue(mockSummary);

    const result = await controller.getDashboardSummary();
    expect(result).toBe(mockSummary);
    expect(mockDashboardService.getDashboardSummary).toHaveBeenCalled();
  });

  it('should delegate getCustomerGrowth to service', async () => {
    const mockGrowth = { success: true, data: { total_customers: 10 } };
    mockDashboardService.getCustomerGrowth.mockResolvedValue(mockGrowth);

    const result = await controller.getCustomerGrowth({ period: '7d' });
    expect(result).toBe(mockGrowth);
    expect(mockDashboardService.getCustomerGrowth).toHaveBeenCalledWith({ period: '7d' });
  });

  it('should delegate getChatStatusStats to service', async () => {
    const mockStats = { success: true, data: { total_chats: 20 } };
    mockDashboardService.getChatStatusStats.mockResolvedValue(mockStats);

    const result = await controller.getChatStatusStats({ timeframe: 'today' });
    expect(result).toBe(mockStats);
    expect(mockDashboardService.getChatStatusStats).toHaveBeenCalledWith({ timeframe: 'today' });
  });

  it('should delegate getAgentActivity to service', async () => {
    const mockRoster = { success: true, data: [] };
    mockDashboardService.getAgentActivity.mockResolvedValue(mockRoster);

    const result = await controller.getAgentActivity({ status: 'online' });
    expect(result).toBe(mockRoster);
    expect(mockDashboardService.getAgentActivity).toHaveBeenCalledWith({ status: 'online' });
  });

  it('should delegate recordAgentHeartbeat to service', async () => {
    const mockResult = { success: true };
    mockDashboardService.recordAgentHeartbeat.mockResolvedValue(mockResult);

    const req = { user: { id: 'agent-1' } };
    const result = await controller.recordAgentHeartbeat(req, { status: 'online' });
    expect(result).toBe(mockResult);
    expect(mockDashboardService.recordAgentHeartbeat).toHaveBeenCalledWith('agent-1', {
      status: 'online',
    });
  });
});
