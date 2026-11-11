import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
    ApiHeader,
    ApiBody,
} from '@nestjs/swagger';
import {
    AssignAgentDto,
    BotLoginDto,
    IncomingMessageDto,
    SendWhatsAppTextMessageDto,
    SetPriorityDto,
} from '../../dto';

/**
 * Swagger documentation decorator for POST v1/webhook (incoming WhatsApp messages)
 */
export function ApiIncomingWebhookDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Receive and handle incoming WhatsApp webhooks',
            description:
                'Processes webhook events from Meta WhatsApp Cloud API with HMAC-SHA256 signature verification and message deduplication.',
        }),
        ApiHeader({
            name: 'x-hub-signature-256',
            description: 'HMAC-SHA256 signature generated with your WhatsApp App Secret',
            required: true,
        }),
        ApiBody({
            type: IncomingMessageDto,
            description: 'WhatsApp webhook event payload containing messages or status updates',
        }),
        ApiResponse({ status: 200, description: 'Webhook received and processed' }),
        ApiResponse({ status: 403, description: 'Forbidden: Invalid webhook signature' }),
    );
}

/**
 * Swagger documentation decorator for GET v1/webhook (Meta verification challenge)
 */
export function ApiVerifyWebhookDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Verify WhatsApp webhook URL',
            description:
                'Endpoint used by Meta during webhook subscription setup to verify endpoint ownership via challenge-response.',
        }),
        ApiQuery({
            name: 'hub.mode',
            description: 'Mode parameter (should be "subscribe")',
            required: true,
            example: 'subscribe',
        }),
        ApiQuery({
            name: 'hub.verify_token',
            description: 'Secret verification token configured in Meta developer portal',
            required: true,
        }),
        ApiQuery({
            name: 'hub.challenge',
            description: 'Challenge string to be echoed back by the server',
            required: true,
        }),
        ApiResponse({
            status: 200,
            description: 'Challenge echoed successfully as plain text',
        }),
        ApiResponse({
            status: 403,
            description: 'Forbidden: Token mismatch or missing parameters',
        }),
    );
}

/**
 * Swagger documentation decorator for GET v1/chat-list
 */
export function ApiGetChatListDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Get paginated list of chat activities',
            description:
                'Returns chat activities with optional status filtering ("waiting", "resolved", "ai_active", "human_active"). By default returns WAITING and AI_ACTIVE.',
        }),
        ApiBearerAuth(),
        ApiQuery({
            name: 'page',
            description: 'Page number for pagination',
            required: false,
            example: 1,
        }),
        ApiQuery({
            name: 'limit',
            description: 'Items per page',
            required: false,
            example: 15,
        }),
        ApiQuery({
            name: 'status',
            description:
                'Filter by chat status name or numeric code (0=waiting, 1=resolved, 2=ai_active, 3=human_active)',
            required: false,
            example: 'waiting',
        }),
        ApiResponse({ status: 200, description: 'Chat list retrieved successfully' }),
        ApiResponse({ status: 401, description: 'Unauthorized' }),
    );
}

/**
 * Swagger documentation decorator for GET v1/chat-details/:id?
 */
export function ApiGetChatDetailsDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Get chat activity details and conversation transcript',
            description:
                'Retrieves full details of a chat activity including chats transcript, customer profile, and assigned agent info.',
        }),
        ApiBearerAuth(),
        ApiParam({
            name: 'id',
            description: 'Chat Activity UUID',
            required: false,
        }),
        ApiQuery({
            name: 'id',
            description: 'Chat Activity UUID (alternative query parameter)',
            required: false,
        }),
        ApiResponse({ status: 200, description: 'Chat details retrieved successfully' }),
        ApiResponse({ status: 400, description: 'Bad Request: Chat activity ID missing' }),
        ApiResponse({ status: 401, description: 'Unauthorized' }),
        ApiResponse({ status: 403, description: 'Forbidden: Agent not assigned or chat not active' }),
        ApiResponse({ status: 404, description: 'Chat activity not found' }),
    );
}

/**
 * Swagger documentation decorator for POST v1/assign-chat
 */
export function ApiAssignChatDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Assign chat activity to an agent',
            description:
                'Assigns an active/waiting chat activity to a specific agent for human takeover.',
        }),
        ApiBearerAuth(),
        ApiBody({ type: AssignAgentDto }),
        ApiResponse({ status: 200, description: 'Agent assigned successfully' }),
        ApiResponse({
            status: 400,
            description: 'Bad Request: Agent already assigned or agent/chat not found',
        }),
        ApiResponse({ status: 401, description: 'Unauthorized' }),
        ApiResponse({
            status: 403,
            description: 'Forbidden: Chat already resolved or unauthorized',
        }),
    );
}

/**
 * Swagger documentation decorator for POST v1/unassign-chat
 */
export function ApiUnassignChatDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Unassign agent from chat activity',
            description:
                'Releases assigned agent from a chat activity.',
        }),
        ApiBearerAuth(),
        ApiBody({ type: AssignAgentDto }),
        ApiResponse({ status: 200, description: 'Agent unassigned successfully' }),
        ApiResponse({
            status: 400,
            description: 'Bad Request: Chat still waiting or in AI handover',
        }),
        ApiResponse({ status: 401, description: 'Unauthorized' }),
        ApiResponse({
            status: 403,
            description: 'Forbidden: Chat already resolved or unauthorized',
        }),
    );
}

/**
 * Swagger documentation decorator for POST v1/send-message
 */
export function ApiSendWhatsAppMessageDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Send an outgoing WhatsApp text message',
            description:
                'Sends a text message to a customer recipient via WhatsApp Cloud API.',
        }),
        ApiBody({ type: SendWhatsAppTextMessageDto }),
        ApiResponse({ status: 200, description: 'Message sent successfully' }),
        ApiResponse({
            status: 400,
            description: 'Bad Request: Missing required parameters or WhatsApp API error',
        }),
    );
}

/**
 * Swagger documentation decorator for POST v1/bot-login
 */
export function ApiBotLoginDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Login to external chatbot service and obtain/refresh authentication token',
            description:
                'Sends authentication credentials to {CHATBOT_BASE_URL}/login, caches the returned JWT token, and returns token details.',
        }),
        ApiBody({ type: BotLoginDto, required: false }),
        ApiResponse({ status: 200, description: 'Bot logged in successfully and token obtained' }),
        ApiResponse({ status: 400, description: 'Chatbot login failed or invalid credentials' }),
    );
}

/**
 * Swagger documentation decorator for POST v1/set-priority
 */
export function ApiSetPriorityDoc() {
    return applyDecorators(
        ApiOperation({
            summary: 'Set priority for a chat activity',
            description:
                'Updates the priority level (1 = Low, 2 = Medium, 3 = High, 4 = Urgent) for a given chat activity UUID.',
        }),
        ApiBody({ type: SetPriorityDto }),
        ApiResponse({ status: 200, description: 'Priority updated successfully' }),
        ApiResponse({ status: 400, description: 'Bad Request: Missing or invalid parameters' }),
        ApiResponse({ status: 404, description: 'Not Found: Chat activity not found' }),
    );
}

