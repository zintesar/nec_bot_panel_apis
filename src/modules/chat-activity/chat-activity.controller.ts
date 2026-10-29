import {
    Controller,
    Post,
    Body,
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
import { ChatActivityDto } from '../../dto';
import { JwtAuthGuard, skipModule } from '../../middleware/guards';
import { winstonLog } from '@config/winstonLog';
import { Response } from 'express';



@Controller('chat-activity')
export class ChatActivityController {
    constructor(private readonly chatActivityService: ChatActivityService) { }

    private readonly verifyToken = "qwer";

    @UseGuards(skipModule)
    @Post('v1/incoming')
    async handleIncomingMessage(
        @Body() chatActivityDto: ChatActivityDto,
    ): Promise<any> {
        try {
            const result = await this.chatActivityService.handleIncomingMessage(chatActivityDto);
            return { status: 'ok' };

            return result;
        } catch (error) {
            return error;
        }
    }

    @Get('v1/incoming')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        // 1. Check mode and token
        if (mode === 'subscribe' && token === this.verifyToken) {
            // 2. Key: return challenge as plain text, cannot use res.json()
            return res.status(HttpStatus.OK).type('text/plain').send(challenge);
        }
        // Verification failure returns 403
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
}

