import {
  Controller,
  UseGuards,
  Post,
  Request,
  Body,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApifetchService } from './apifetch.service';
import { JwtAuthGuard } from '../../middleware/guards';
import {
  ApiFetch3PartyDoc,
  ApiGetQuoteDoc,
  ApiSubmitQuoteDoc,
} from './apifetch.swagger';

@ApiTags('API Fetch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('apifetch')
export class ApifetchController {
  constructor(private apifetchService: ApifetchService) {}

  /**
   * POST /apifetch/v1/fetch3partyapi
   * Fetches data from external third-party integration API.
   */
  @ApiFetch3PartyDoc()
  @Post('v1/fetch3partyapi')
  async fetch3partyapi(@Request() req, @Body() requestbody: any) {
    return await this.apifetchService.fetch3partyapi(requestbody);
  }

  /**
   * GET /apifetch/v1/getQuote
   * Retrieves quotes from external integration service.
   */
  @ApiGetQuoteDoc()
  @Get('v1/getQuote')
  async getQuote(@Body() requestbody: any) {
    return await this.apifetchService.getQuotes();
  }

  /**
   * POST /apifetch/v1/submitQuote
   * Submits quote to external integration service.
   */
  @ApiSubmitQuoteDoc()
  @Post('v1/submitQuote')
  async submitQuote(@Request() req, @Body() requestbody: any) {
    return await this.apifetchService.submitQuotes(requestbody);
  }
}
