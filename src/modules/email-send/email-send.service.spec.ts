import { Test, TestingModule } from '@nestjs/testing';
import { EmailSendService } from './email-send.service';
import { ProducerService } from '../../config/kafka/producer/producer.service';
import { ConsumerService } from '../../config/kafka/consumer/consumer.service';
import * as nodemailer from 'nodemailer';

jest.mock('../../config/kafka/producer/producer.service');
jest.mock('../../config/kafka/consumer/consumer.service');
jest.mock('@config/winstonLog', () => ({
  winstonLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('EmailSendService', () => {
  let service: EmailSendService;
  let mockSendMail: jest.Mock;

  const mockProducerService = {
    produce: jest.fn(),
  };

  const mockConsumerService = {
    consume: jest.fn(),
  };

  beforeEach(async () => {
    process.env.IS_CRD_PLAIN = 'true';
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id-123' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: mockSendMail,
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSendService,
        {
          provide: ProducerService,
          useValue: mockProducerService,
        },
        {
          provide: ConsumerService,
          useValue: mockConsumerService,
        },
      ],
    }).compile();

    service = module.get<EmailSendService>(EmailSendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send agent handoff alert email successfully', async () => {
    const payload = {
      recipients: ['agent1@example.com', 'agent2@example.com'],
      customer: {
        name: 'John Doe',
        phone: '+1234567890',
      },
      activityId: 'activity-uuid-123',
      customerMessage: 'I need to talk to a human agent immediately',
      requestedAt: new Date('2026-11-12T10:00:00Z'),
    };

    const result = await service.sendAgentHandoffAlert(payload);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: payload.recipients,
        subject: expect.stringContaining(payload.activityId),
        text: expect.stringContaining('John Doe'),
        html: expect.stringContaining('activity-uuid-123'),
      }),
    );
    expect(result).toEqual({ messageId: 'test-msg-id-123' });
  });

  it('should return null and warn if recipients list is empty', async () => {
    const result = await service.sendAgentHandoffAlert({
      recipients: [],
      customer: { name: 'Test' },
      activityId: 'act-1',
      customerMessage: 'Hello',
    });

    expect(result).toBeNull();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should throw error if transporter.sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(
      service.sendAgentHandoffAlert({
        recipients: ['agent@example.com'],
        customer: { name: 'Test' },
        activityId: 'act-1',
        customerMessage: 'Help',
      }),
    ).rejects.toThrow('SMTP connection refused');
  });
});
