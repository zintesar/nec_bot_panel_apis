import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ChatActivityService } from './chat-activity.service';
import { ChatActivityDto, } from '../../dto';
import { JwtAuthGuard } from '../../middleware/guards';


@Controller('chat-activity')
export class ChatActivityController {
    constructor(private readonly chatActivityService: ChatActivityService) { }

    @Post('v1/incoming')
    async handleIncomingMessage(
        @Body() chatActivityDto: ChatActivityDto,
    ): Promise<any> {
        try {
            const result = await this.chatActivityService.handleIncomingMessage(chatActivityDto);
            return result;
        } catch (error) {
            return error;
        }
    }
}
