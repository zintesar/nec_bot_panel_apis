import {
    Controller,
    Post,
    Body,
    Req,
    Headers,
    Request,
    UseGuards,
    Get,
    Query,
    Param,
    BadRequestException,
    Res,
    HttpStatus,
} from '@nestjs/common';
import { ChatActivityService } from './chat-activity.service';
import { AssignAgentDto, ChatActivityDto, SendWhatsAppTextMessageDto } from '../../dto';
import { JwtAuthGuard, skipModule } from '../../middleware/guards';
import { winstonLog } from '@config/winstonLog';
import { Response, Request as ExpressRequest } from 'express';
import {
    SeenMessageIds,
    isSignatureValid,
    iterTextMessages,
} from './whatsapp-webhook.util';



@Controller('chat-activity')
export class ChatActivityController {
    constructor(private readonly chatActivityService: ChatActivityService) { }

    private readonly verifyToken = 'qwer';
    private readonly seenMessages = new SeenMessageIds();

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

            // 1. Check HMAC-SHA256 signature
            if (!isSignatureValid(appSecret, rawBody, signatureHeader)) {
                winstonLog.warn('Rejected WhatsApp webhook with an invalid signature');
                return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
            }

            // 2. Safely extract text messages
            const textMessages = iterTextMessages(chatActivityDto);

            // 3. Process messages asynchronously with deduplication
            for (const msg of textMessages) {
                if (!this.seenMessages.remember(msg.messageId)) {
                    winstonLog.info(`Ignoring duplicate WhatsApp message ${msg.messageId}`);
                    continue;
                }

                // Background async processing without blocking Meta webhook response
                this.chatActivityService.processWhatsAppTextMessage(msg).catch((err) => {
                    winstonLog.error(`Error processing WhatsApp message ${msg.messageId}: ${err?.message || err}`);
                });
            }

            // 4. Promptly return 200 OK to prevent WhatsApp retry cascade
            return res.status(HttpStatus.OK).json({ status: 'ok' });
        } catch (error) {
            winstonLog.error(`Error handling incoming WhatsApp webhook: ${error?.message || error}`);
            return res.status(HttpStatus.OK).json({ status: 'ok' });
        }
    }

    @Get('v1/webhook')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        console.log("🚀 ~ ChatActivityController ~ verifyWebhook ~ challenge:", challenge)
        console.log("🚀 ~ ChatActivityController ~ verifyWebhook ~ token:", token)
        console.log("🚀 ~ ChatActivityController ~ verifyWebhook ~ mode:", mode)
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || this.verifyToken;
        // 1. Check mode, verify token, and challenge presence
        if (mode === 'subscribe' && token === verifyToken && challenge) {
            winstonLog.info('WhatsApp webhook verified');
            // 2. Return challenge as plain text
            return res.status(HttpStatus.OK).type('text/plain').send(challenge);
        }
        // Verification failure returns 403
        winstonLog.warn('WhatsApp webhook verification failed');
        return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }

    @UseGuards(JwtAuthGuard)
    @Get('v1/chat-list')
    async getChatList(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 15,
        @Query('status') status: string = '',
    ): Promise<any> {
        const result = await this.chatActivityService.getChatList(
            page,
            limit,
            status,
        );
        return result;
    }

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

    @UseGuards(JwtAuthGuard)
    @Post('v1/assign-chat')
    async assignChat(
        @Body() body: AssignAgentDto,
        @Request() req: any,
    ): Promise<any> {
        return await this.chatActivityService.assignAgent(body, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('v1/unassign-chat')
    async unassignChat(
        @Body() body: AssignAgentDto,
        @Request() req: any,
    ): Promise<any> {
        return await this.chatActivityService.unassignAgent(body, req.user);
    }


    @UseGuards(skipModule)
    @Post(['v1/send-message', 'send-message'])
    async sendWhatsAppMessage(
        @Body() sendDto: SendWhatsAppTextMessageDto,
    ): Promise<any> {
        return await this.chatActivityService.sendWhatsAppTextMessage(sendDto);
    }

}

