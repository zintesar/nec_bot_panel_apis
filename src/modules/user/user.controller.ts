import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserDto } from '../../dto';
import { AgentProfileQueryDto } from '../../dto/agent.dto';
import { JwtAuthGuard } from '../../middleware/guards';
import {
  ApiUserCreateDoc,
  ApiUserEditDoc,
  ApiUserDeleteDoc,
  ApiUserListDoc,
  ApiUserAgentProfileListDoc,
  ApiUserAgentProfileByIdDoc,
  ApiUserActivityDoc,
  ApiUserFindByIdDoc,
} from './user.swagger';

@ApiTags('User')
@Controller('v1/user')
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * POST /v1/user
   * Creates a new user profile.
   */
  @ApiUserCreateDoc()
  @Post('/')
  async userCreate(@Body() reqbody: UserDto) {
    return await this.userService.create(reqbody);
  }

  /**
   * PUT /v1/user/:id
   * Updates user profile by ID.
   */
  @ApiUserEditDoc()
  @Put('/:id')
  async userEdit(@Param('id') id: string, @Body() reqbody: UserDto) {
    return await this.userService.update(id, reqbody);
  }

  /**
   * DELETE /v1/user/:id
   * Deletes user by ID.
   */
  @ApiUserDeleteDoc()
  @Delete('/:id')
  async userDelete(@Param('id') id: string) {
    return await this.userService.delete(id);
  }

  /**
   * GET /v1/user
   * Retrieves all users.
   */
  @ApiUserListDoc()
  @Get('/')
  async userList() {
    return await this.userService.findAll();
  }

  /**
   * GET /v1/user/agent/profile-list
   * Retrieves paginated agent profile list with workload stats.
   */
  @ApiUserAgentProfileListDoc()
  @UseGuards(JwtAuthGuard)
  @Get(['agent/profile-list', 'agent-list', 'agents'])
  async agentProfileList(@Query() query: AgentProfileQueryDto) {
    return await this.userService.getAgentProfileList(query);
  }

  /**
   * GET /v1/user/agent/profile/:id
   * Retrieves single agent profile with active and recent chats.
   */
  @ApiUserAgentProfileByIdDoc()
  @UseGuards(JwtAuthGuard)
  @Get(['agent/profile/:id', 'agent/:id'])
  async agentProfileById(@Param('id') id: string) {
    return await this.userService.getAgentProfileById(id);
  }

  /**
   * GET /v1/user/activity
   * Retrieves all agents with their chat activities.
   */
  @ApiUserActivityDoc()
  @Get('/activity')
  async userActivity() {
    return await this.userService.findAllActivity();
  }

  /**
   * GET /v1/user/:id
   * Retrieves single user by UUID.
   */
  @ApiUserFindByIdDoc()
  @Get('/:id')
  async userFindById(@Param('id') id: string) {
    return await this.userService.findOneById(id);
  }
}
