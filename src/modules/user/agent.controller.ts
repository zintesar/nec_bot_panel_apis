import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AgentProfileQueryDto } from '../../dto/agent.dto';
import { JwtAuthGuard } from '../../middleware/guards';
import {
  ApiGetAgentProfileListDoc,
  ApiGetAgentProfileByIdDoc,
} from './agent.swagger';

@ApiTags('Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['agent', 'v1/agent'])
export class AgentController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /nbapi/agent/v1/profile-list
   * Retrieves paginated agent profile list with workload stats and latest chat activity.
   */
  @ApiGetAgentProfileListDoc()
  @Get(['v1/profile-list', 'profile-list', 'v1/list', 'list', ''])
  async getAgentProfileList(@Query() query: AgentProfileQueryDto) {
    return await this.userService.getAgentProfileList(query);
  }

  /**
   * GET /nbapi/agent/v1/profile/:id
   * Retrieves single agent profile with active and recent chats by UUID or User_Id.
   */
  @ApiGetAgentProfileByIdDoc()
  @Get(['v1/profile/:id', 'profile/:id', ':id'])
  async getAgentProfileById(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Agent ID is required');
    }
    return await this.userService.getAgentProfileById(id);
  }
}
