import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

describe('CustomerController', () => {
  let controller: CustomerController;
  let service: CustomerService;

  const mockCustomerService = {
    getCustomerProfileList: jest.fn(),
    getCustomerProfileById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        {
          provide: CustomerService,
          useValue: mockCustomerService,
        },
      ],
    }).compile();

    controller = module.get<CustomerController>(CustomerController);
    service = module.get<CustomerService>(CustomerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate getCustomerProfileList to CustomerService', async () => {
    const mockResponse = {
      success: true,
      data: [],
      pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
    };
    mockCustomerService.getCustomerProfileList.mockResolvedValue(mockResponse);

    const result = await controller.getCustomerProfileList({ page: 1, limit: 15 });
    expect(result).toBe(mockResponse);
    expect(mockCustomerService.getCustomerProfileList).toHaveBeenCalledWith({
      page: 1,
      limit: 15,
    });
  });

  it('should delegate getCustomerProfileById to CustomerService', async () => {
    const mockProfile = {
      success: true,
      data: { id: 'cust-1', name: 'Alice' },
    };
    mockCustomerService.getCustomerProfileById.mockResolvedValue(mockProfile);

    const result = await controller.getCustomerProfileById('cust-1');
    expect(result).toBe(mockProfile);
    expect(mockCustomerService.getCustomerProfileById).toHaveBeenCalledWith('cust-1');
  });
});

