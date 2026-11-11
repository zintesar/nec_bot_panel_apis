import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { winstonLog } from '@config/winstonLog';

export interface BotTokenResponse {
    token: string;
    token_type: string;
    expires_in: number;
}

interface BotTokenCache extends BotTokenResponse {
    expires_at: number;
}

export interface BotMessageRequest {
    message: string;
    session_id: string;
    language?: string;
    [key: string]: any;
}

export interface BotMessageResponse {
    success: boolean;
    answer: string;
    confidence?: number;
    session_id: string;
    awaiting_app_link_reply?: boolean;
    awaiting_rate_reply?: boolean;
    awaiting_txn_reply?: boolean;
    language?: string;
    speech_locale?: string;
    faq_id?: string | null;
    intent?: string | null;
    decision_source?: string;
    detected_language?: string | null;
    whatsapp_url?: string | null;
    [key: string]: any;
}

@Injectable()
export class ChatBotService {
    // Shared in-memory token cache across requests
    private static tokenCache: BotTokenCache | null = null;

    /**
     * Resolves the base URL for the external chatbot service from environment variables.
     *
     * @returns Normalized base URL without trailing slashes
     */
    private getBaseUrl(): string {
        const rawUrl = process.env.CHATBOT_BASE_URL || process.env.CALL_BOT_API_URL || '';
        return rawUrl.replace(/\/+$/, '');
    }

    /**
     * Authenticates with external chatbot service ({CHATBOT_BASE_URL}/login)
     * and caches the returned Bearer token in memory.
     *
     * @param credentials - Optional username/password override
     * @returns Bot token metadata { token, token_type, expires_in }
     */
    async botLogin(credentials?: { username?: string; password?: string }): Promise<BotTokenResponse> {
        // Step 1: Resolve base URL and authentication credentials
        const baseUrl = this.getBaseUrl();
        const loginUrl = `${baseUrl}/login`;

        const username = credentials?.username || process.env.CHATBOT_USERNAME || 'nec-engagement';
        const password = credentials?.password || process.env.CHATBOT_PASSWORD || '6sZzS0ICpguS0yvGlh1JwUCL';

        const payload = { username, password };
        winstonLog.info(`Logging in to chatbot service at: ${loginUrl}`);

        try {
            // Step 2: Post credentials to /login endpoint
            const response = await axios.post(loginUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });

            const data = response.data;
            const token = data?.token || data?.access_token || data?.jwt;
            const tokenType = data?.token_type || data?.tokenType || 'Bearer';
            const expiresIn = Number(data?.expires_in || data?.expiresIn) || 86400;

            if (!token) {
                winstonLog.error(`Chatbot login returned successful status but missing token: ${JSON.stringify(data)}`);
                throw new BadRequestException('Chatbot login did not return a valid token');
            }

            // Step 3: Validate and cache Bearer JWT token with 60s safety buffer
            const expiresAt = Date.now() + Math.max(0, (expiresIn - 60)) * 1000;
            ChatBotService.tokenCache = {
                token,
                token_type: tokenType,
                expires_in: expiresIn,
                expires_at: expiresAt,
            };

            winstonLog.info(`Chatbot login success. Token cached (expires in ${expiresIn}s)`);

            // Step 4: Return token details
            return {
                token,
                token_type: tokenType,
                expires_in: expiresIn,
            };
        } catch (error: any) {
            const errorDetails = error?.response?.data || error?.message || error;
            winstonLog.error(`Chatbot login failed at ${loginUrl}: ${JSON.stringify(errorDetails)}`);
            throw error;
        }
    }

    /**
     * Returns an active valid Bearer token, automatically logging in if missing or expired.
     *
     * @returns Valid token string and token type
     */
    async getValidToken(): Promise<{ token: string; tokenType: string }> {
        // Step 1: Check in-memory cache for valid unexpired token
        const now = Date.now();
        if (ChatBotService.tokenCache && ChatBotService.tokenCache.expires_at > now) {
            return {
                token: ChatBotService.tokenCache.token,
                tokenType: ChatBotService.tokenCache.token_type || 'Bearer',
            };
        }

        // Step 2: Perform fresh authentication if cached token is missing or expired
        const loginRes = await this.botLogin();
        return {
            token: loginRes.token,
            tokenType: loginRes.token_type || 'Bearer',
        };
    }

    /**
     * Calls the external bot API with formatted payload:
     * {
     *   "message": "customer text here",
     *   "session_id": "your-conversation-id",
     *   "language": "en"
     * }
     *
     * Expected response:
     * {
     *   "success": true,
     *   "answer": "text to send to the customer on WhatsApp",
     *   "confidence": 90,
     *   "session_id": "your-conversation-id",
     *   ...
     * }
     *
     * Automatically obtains and attaches Bearer token, and retries once on 401.
     *
     * @param data - Request payload with message and session
     * @param options - Additional axios options (headers, timeout, etc.)
     * @returns Bot response object
     */
    async callBotApi(data: BotMessageRequest | any, options?: any): Promise<BotMessageResponse | any> {
        // Step 1: Resolve target bot endpoint URL and request headers
        const url = process.env.CALL_BOT_API_URL || `${this.getBaseUrl()}/message`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        };

        // Step 2: Normalize and format payload to contract { message, session_id, language }
        const payload: BotMessageRequest = {
            message: String(data?.message ?? data?.text ?? data?.body ?? ''),
            session_id: String(data?.session_id ?? data?.sessionId ?? data?.activity_id ?? data?.Activity_Id ?? ''),
            language: String(data?.language ?? data?.lang ?? 'en'),
            ...(typeof data === 'object' ? data : {}),
        };
        // Enforce required field values
        payload.message = String(data?.message ?? data?.text ?? data?.body ?? '');
        payload.session_id = String(data?.session_id ?? data?.sessionId ?? data?.activity_id ?? data?.Activity_Id ?? '');
        payload.language = String(data?.language ?? data?.lang ?? 'en');

        // Step 3: Retrieve valid Bearer token and attach Authorization header
        try {
            const { token, tokenType } = await this.getValidToken();
            if (token) {
                headers['Authorization'] = `${tokenType} ${token}`;
            }
        } catch (err: any) {
            winstonLog.warn(`Could not obtain bot login token, falling back to CALL_BOT_API_KEY: ${err?.message || err}`);
            if (process.env.CALL_BOT_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.CALL_BOT_API_KEY}`;
            }
        }

        const bodyStr = JSON.stringify(payload);
        winstonLog.info(`calling nec bot api on url: ${url}`);
        winstonLog.info(`calling nec bot api with body: ${bodyStr}`);

        // Step 4: Dispatch HTTP POST to external bot endpoint
        try {
            const response = await axios.post(url, payload, {
                headers,
                timeout: options?.timeout || 20000,
            });

            winstonLog.info(`call nec bot api success`);
            winstonLog.info(`call nec bot api response: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error: any) {
            // Step 5: Handle 401 Unauthorized with token refresh and automatic retry
            if (error?.response?.status === 401 && !options?._isRetry) {
                winstonLog.warn('Bot API returned 401 Unauthorized. Refreshing token and retrying...');
                ChatBotService.tokenCache = null;
                try {
                    const freshLogin = await this.botLogin();
                    if (freshLogin?.token) {
                        headers['Authorization'] = `${freshLogin.token_type || 'Bearer'} ${freshLogin.token}`;
                        const retryResponse = await axios.post(url, payload, {
                            headers,
                            timeout: options?.timeout || 20000,
                        });
                        winstonLog.info('Bot API retry after 401 succeeded');
                        return retryResponse.data;
                    }
                } catch (retryErr: any) {
                    winstonLog.error(`Bot API retry after 401 failed: ${retryErr?.message || retryErr}`);
                }
            }

            winstonLog.error(`Error calling nec bot api on url: ${url}`);
            winstonLog.error(`Error calling nec bot api with body: ${bodyStr}`);
            winstonLog.error(`Error calling nec bot api with error: ${error?.message || error}`);
            return error;
        }
    }

    /**
     * Convenience method to send a customer message to the bot.
     *
     * @param message - User text message
     * @param sessionId - Conversation / activity identifier
     * @param language - Language code (defaults to 'en')
     * @returns Bot response
     */
    async sendMessageToBot(
        message: string,
        sessionId: string,
        language: string = 'en',
    ): Promise<BotMessageResponse> {
        // Step 1: Forward parameters to callBotApi
        return await this.callBotApi({
            message,
            session_id: sessionId,
            language,
        });
    }
}
