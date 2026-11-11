import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { UserService } from './user.service';

describe('AgentController', () => {
  let controller: AgentController;
  let service: UserService;

  const mockUserService = {
    getAgentProfileList: jest.fn(),
    getAgentProfileById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate getAgentProfileList to UserService', async () => {
    const mockResponse = {
      success: true,
      data: [],
      pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
    };
    mockUserService.getAgentProfileList.mockResolvedValue(mockResponse);

    const result = await controller.getAgentProfileList({ page: 1, limit: 15 });
    expect(result).toBe(mockResponse);
    expect(mockUserService.getAgentProfileList).toHaveBeenCalledWith({
      page: 1,
      limit: 15,
    });
  });

  it('should delegate getAgentProfileById to UserService', async () => {
    const mockProfile = {
      success: true,
      data: { id: 'agent-1', user_id: 'AGENT01', name: 'Bob' },
    };
    mockUserService.getAgentProfileById.mockResolvedValue(mockProfile);

    const result = await controller.getAgentProfileById('agent-1');
    expect(result).toBe(mockProfile);
    expect(mockUserService.getAgentProfileById).toHaveBeenCalledWith('agent-1');
  });
});

