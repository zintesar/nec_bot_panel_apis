import { Test, TestingModule } from '@nestjs/testing';
import { ChatBotService } from './chat-bot.service';
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

describe('ChatBotService', () => {
  let service: ChatBotService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (ChatBotService as any).tokenCache = null;
    process.env.CHATBOT_BASE_URL = 'https://api.necbot.com';
    process.env.CHATBOT_USERNAME = 'nec-engagement';
    process.env.CHATBOT_PASSWORD = '6sZzS0ICpguS0yvGlh1JwUCL';

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatBotService],
    }).compile();

    service = module.get<ChatBotService>(ChatBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('botLogin', () => {
    it('should authenticate against {CHATBOT_BASE_URL}/login with credentials and cache the token', async () => {
      const mockLoginResponse = {
        token: 'mock-jwt-token-xyz',
        token_type: 'Bearer',
        expires_in: 86400,
      };

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockLoginResponse,
      } as any);

      const result = await service.botLogin();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.necbot.com/login',
        {
          username: 'nec-engagement',
          password: '6sZzS0ICpguS0yvGlh1JwUCL',
        },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(result).toEqual({
        token: 'mock-jwt-token-xyz',
        token_type: 'Bearer',
        expires_in: 86400,
      });

      // Verify token cache was set
      const cached = (ChatBotService as any).tokenCache;
      expect(cached).toBeDefined();
      expect(cached.token).toBe('mock-jwt-token-xyz');
    });

    it('should support custom credentials passed via argument', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { token: 'custom-token', token_type: 'Bearer', expires_in: 3600 },
      } as any);

      const result = await service.botLogin({
        username: 'custom-user',
        password: 'custom-password',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.necbot.com/login',
        {
          username: 'custom-user',
          password: 'custom-password',
        },
        expect.any(Object),
      );
      expect(result.token).toBe('custom-token');
    });

    it('should throw error when login endpoint fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(service.botLogin()).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getValidToken', () => {
    it('should reuse cached token if still valid', async () => {
      (ChatBotService as any).tokenCache = {
        token: 'existing-valid-token',
        token_type: 'Bearer',
        expires_in: 86400,
        expires_at: Date.now() + 100000,
      };

      const result = await service.getValidToken();

      expect(result.token).toBe('existing-valid-token');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should re-authenticate if cached token is expired or missing', async () => {
      (ChatBotService as any).tokenCache = {
        token: 'old-expired-token',
        token_type: 'Bearer',
        expires_in: 86400,
        expires_at: Date.now() - 5000,
      };

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { token: 'new-token', token_type: 'Bearer', expires_in: 86400 },
      } as any);

      const result = await service.getValidToken();

      expect(result.token).toBe('new-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.necbot.com/login',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('callBotApi', () => {
    it('should automatically obtain/use bearer token in callBotApi and match request/response contract', async () => {
      // 1. Mock login call
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { token: 'bearer-jwt-123', token_type: 'Bearer', expires_in: 86400 },
      } as any);

      // 2. Mock callBotApi call matching user specification
      const mockPayload = {
        message: 'customer text here',
        session_id: 'your-conversation-id',
        language: 'en',
      };
      const mockBotReply = {
        success: true,
        answer: 'text to send to the customer on WhatsApp',
        confidence: 90,
        session_id: 'your-conversation-id',
        awaiting_app_link_reply: false,
        awaiting_rate_reply: false,
        awaiting_txn_reply: false,
        language: 'en',
        speech_locale: 'en-GB',
        faq_id: null,
        intent: null,
        decision_source: 'csv',
        detected_language: null,
        whatsapp_url: null,
      };
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockBotReply,
      } as any);

      const result = await service.callBotApi(mockPayload);

      // Verify login call happened
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'https://api.necbot.com/login',
        expect.any(Object),
        expect.any(Object),
      );

      // Verify message call included Authorization header with bearer token and payload
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'https://api.necbot.com/message',
        mockPayload,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer-jwt-123',
            'Content-Type': 'application/json',
          }),
        }),
      );

      expect(result).toEqual(mockBotReply);
    });

    it('should support sendMessageToBot convenience helper', async () => {
      (ChatBotService as any).tokenCache = {
        token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 86400,
        expires_at: Date.now() + 100000,
      };

      const mockBotReply = {
        success: true,
        answer: 'text to send to the customer on WhatsApp',
        confidence: 90,
        session_id: 'conv-123',
      };

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockBotReply,
      } as any);

      const result = await service.sendMessageToBot('Hello', 'conv-123', 'en');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.necbot.com/message',
        {
          message: 'Hello',
          session_id: 'conv-123',
          language: 'en',
        },
        expect.any(Object),
      );
      expect(result).toEqual(mockBotReply);
    });

    it('should retry once on 401 Unauthorized by clearing token, re-logging in, and retrying', async () => {
      // Pre-seed cached token
      (ChatBotService as any).tokenCache = {
        token: 'stale-token',
        token_type: 'Bearer',
        expires_in: 86400,
        expires_at: Date.now() + 50000,
      };

      // 1. First bot call returns 401
      const error401: any = new Error('Unauthorized');
      error401.response = { status: 401 };
      mockedAxios.post.mockRejectedValueOnce(error401);

      // 2. Re-login call succeeds with new token
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { token: 'fresh-token-456', token_type: 'Bearer', expires_in: 86400 },
      } as any);

      // 3. Retry bot call succeeds
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      } as any);

      const result = await service.callBotApi({
        message: 'hello',
        session_id: 'sess-1',
      });

      expect(result).toEqual({ success: true });
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });
  });
});
