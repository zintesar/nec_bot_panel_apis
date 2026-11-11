import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    Headers,
    Request,
    Query,
    Param,
    UseGuards,
    BadRequestException,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request as ExpressRequest } from 'express';
import { winstonLog } from '@config/winstonLog';
import {
    AssignAgentDto,
    BotLoginDto,
    SendWhatsAppTextMessageDto,
} from '../../dto';
import { JwtAuthGuard, skipModule } from '../../middleware/guards';
import { ChatActivityService } from './chat-activity.service';
import {
    SeenMessageIds,
    isSignatureValid,
    iterTextMessages,
} from './whatsapp-webhook.util';
import {
    ApiIncomingWebhookDoc,
    ApiVerifyWebhookDoc,
    ApiGetChatListDoc,
    ApiGetChatDetailsDoc,
    ApiAssignChatDoc,
    ApiUnassignChatDoc,
    ApiSendWhatsAppMessageDoc,
    ApiBotLoginDoc,
} from './chat-activity.swagger';

@ApiTags('Chat Activity')
@Controller('chat-activity')
export class ChatActivityController {
    constructor(private readonly chatActivityService: ChatActivityService) {}

    private readonly verifyToken = 'qwer';
    private readonly seenMessages = new SeenMessageIds();

    /**
     * POST /chat-activity/v1/webhook
     * Handles incoming WhatsApp webhook events from Meta Cloud API.
     */
    @ApiIncomingWebhookDoc()
    @UseGuards(skipModule)
    @Post('v1/webhook')
    async handleIncomingMessage(
        @Req() req: ExpressRequest & { rawBody?: Buffer },
        @Headers('x-hub-signature-256') signatureHeader: string,
        @Body() chatActivityDto: any,
        @Res() res: Response,
    ): Promise<any> {
        try {
            const appSecret = process.env.WHATSAPP_APP_SECRET || '';
            const rawBody = req.rawBody || Buffer.from(JSON.stringify(chatActivityDto || {}));

            // 1. Verify HMAC-SHA256 signature
            if (!isSignatureValid(appSecret, rawBody, signatureHeader)) {
                winstonLog.warn('Rejected WhatsApp webhook with an invalid signature');
                return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
            }

            // 2. Extract and iterate over incoming text messages
            const textMessages = iterTextMessages(chatActivityDto);

            // 3. Process messages asynchronously with deduplication
            for (const msg of textMessages) {
                if (!this.seenMessages.remember(msg.messageId)) {
                    winstonLog.info(`Ignoring duplicate WhatsApp message ${msg.messageId}`);
                    continue;
                }

                // Process in background without blocking Meta webhook response
                this.chatActivityService.processWhatsAppTextMessage(msg).catch((err) => {
                    winstonLog.error(`Error processing WhatsApp message ${msg.messageId}: ${err?.message || err}`);
                });
            }

            // 4. Return 200 OK promptly to prevent Meta retry cascade
            return res.status(HttpStatus.OK).json({ status: 'ok' });
        } catch (error: any) {
            winstonLog.error(`Error handling incoming WhatsApp webhook: ${error?.message || error}`);
            return res.status(HttpStatus.OK).json({ status: 'ok' });
        }
    }

    /**
     * GET /chat-activity/v1/webhook
     * Challenge-response endpoint used by Meta to verify webhook subscription.
     */
    @ApiVerifyWebhookDoc()
    @Get('v1/webhook')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || this.verifyToken;

        if (mode === 'subscribe' && token === verifyToken && challenge) {
            winstonLog.info('WhatsApp webhook verified');
            return res.status(HttpStatus.OK).type('text/plain').send(challenge);
        }

        winstonLog.warn('WhatsApp webhook verification failed');
        return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }

    /**
     * GET /chat-activity/v1/chat-list
     * Retrieves paginated list of chat activities with optional status filtering.
     */
    @ApiGetChatListDoc()
    @UseGuards(JwtAuthGuard)
    @Get('v1/chat-list')
    async getChatList(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 15,
        @Query('status') status: string = '',
    ): Promise<any> {
        return await this.chatActivityService.getChatList(page, limit, status);
    }

    /**
     * GET /chat-activity/v1/chat-details/:id?
     * Retrieves conversation transcript and details for a chat activity.
     */
    @ApiGetChatDetailsDoc()
    @UseGuards(JwtAuthGuard)
    @Get('v1/chat-details/:id?')
    async getChatDetails(
        @Param('id') paramId: string,
        @Query('id') queryId: string,
        @Request() req: any,
    ): Promise<any> {
        const id = paramId || queryId;
        if (!id) {
            throw new BadRequestException('Chat activity ID is required');
        }
        return await this.chatActivityService.getChatDetails(id, req.user);
    }

    /**
     * POST /chat-activity/v1/assign-chat
     * Assigns an active/waiting chat to a support agent.
     */
    @ApiAssignChatDoc()
    @UseGuards(JwtAuthGuard)
    @Post('v1/assign-chat')
    async assignChat(
        @Body() body: AssignAgentDto,
        @Request() req: any,
    ): Promise<any> {
        return await this.chatActivityService.assignAgent(body, req.user);
    }

    /**
     * POST /chat-activity/v1/unassign-chat
     * Releases an assigned agent from a chat, returning it to AI handling.
     */
    @ApiUnassignChatDoc()
    @UseGuards(JwtAuthGuard)
    @Post('v1/unassign-chat')
    async unassignChat(
        @Body() body: AssignAgentDto,
        @Request() req: any,
    ): Promise<any> {
        return await this.chatActivityService.unassignAgent(body, req.user);
    }

    /**
     * POST /chat-activity/v1/send-message
     * Sends an outbound text message to a customer via WhatsApp Cloud API.
     */
    @ApiSendWhatsAppMessageDoc()
    @UseGuards(skipModule)
    @Post(['v1/send-message', 'send-message'])
    async sendWhatsAppMessage(
        @Body() sendDto: SendWhatsAppTextMessageDto,
    ): Promise<any> {
        return await this.chatActivityService.sendWhatsAppTextMessage(sendDto);
    }

    /**
     * POST /chat-activity/v1/bot-login
     * Authenticates with external chatbot service and returns/caches JWT token.
     */
    @ApiBotLoginDoc()
    @UseGuards(skipModule)
    @Post(['v1/bot-login', 'bot-login'])
    async botLogin(
        @Body() body?: BotLoginDto,
    ): Promise<any> {
        return await this.chatActivityService.botLogin(body);
    }
}
