import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  AgentActivityQueryDto,
  AgentHeartbeatDto,
  ChatStatusQueryDto,
  CustomerGrowthQueryDto,
} from '../../dto/dashboard.dto';
import { JwtAuthGuard } from '../../middleware/guards';
import {
  ApiDashboardSummaryDoc,
  ApiCustomerGrowthDoc,
  ApiChatStatusStatsDoc,
  ApiAgentActivityDoc,
  ApiAgentHeartbeatDoc,
} from './dashboard.swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['dashboard', 'v1/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /nbapi/dashboard/v1/summary
   * Returns unified dashboard overview metrics (customer growth, chat pipeline, agent workforce).
   */
  @ApiDashboardSummaryDoc()
  @Get(['v1/summary', 'summary', ''])
  async getDashboardSummary() {
    return await this.dashboardService.getDashboardSummary();
  }

  /**
   * GET /nbapi/dashboard/v1/customers/growth
   * Returns customer totals and percentage growth compared to preceding period (1d, 7d, 30d, 1y).
   */
  @ApiCustomerGrowthDoc()
  @Get(['v1/customers/growth', 'customers/growth'])
  async getCustomerGrowth(@Query() query: CustomerGrowthQueryDto) {
    return await this.dashboardService.getCustomerGrowth(query);
  }

  /**
   * GET /nbapi/dashboard/v1/chat-activity/stats
   * Returns chat activity pipeline status breakdown (waiting, AI in progress, completed, human active).
   */
  @ApiChatStatusStatsDoc()
  @Get(['v1/chat-activity/stats', 'chat-activity/stats'])
  async getChatStatusStats(@Query() query: ChatStatusQueryDto) {
    return await this.dashboardService.getChatStatusStats(query);
  }

  /**
   * GET /nbapi/dashboard/v1/agent-activity
   * Returns agent activity roster (presence status, assigned chat, interaction start time, duration).
   */
  @ApiAgentActivityDoc()
  @Get(['v1/agent-activity', 'agent-activity'])
  async getAgentActivity(@Query() query: AgentActivityQueryDto) {
    return await this.dashboardService.getAgentActivity(query);
  }

  /**
   * POST /nbapi/dashboard/v1/agent/heartbeat
   * Records agent presence signal to maintain active online/away state.
   */
  @ApiAgentHeartbeatDoc()
  @Post(['v1/agent/heartbeat', 'agent/heartbeat'])
  async recordAgentHeartbeat(
    @Request() req: any,
    @Body() heartbeatDto: AgentHeartbeatDto,
  ) {
    const agentId = req.user?.id || req.user?.Id || req.user?.user_id;
    return await this.dashboardService.recordAgentHeartbeat(
      agentId,
      heartbeatDto,
    );
  }
}
