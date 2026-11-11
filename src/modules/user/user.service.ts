import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import {
  ChatActivityModel,
  ChatActivityStatus,
  CustomerModel,
  UserModel,
} from '../../models';
import {
  USER_REPOSITORY,
  CHAT_ACTIVITY_REPOSITORY,
  CUSTOMER_REPOSITORY,
  DATABASE_CONNECTION,
} from '../../config/constants';
import { Sequelize } from 'sequelize-typescript';
import { AgentProfileQueryDto } from '../../dto/agent.dto';
import { winstonLog } from '../../config/winstonLog';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
    @Inject(CHAT_ACTIVITY_REPOSITORY)
    private readonly chatActivityRepository: typeof ChatActivityModel,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: typeof CustomerModel,
    @Inject(DATABASE_CONNECTION) private DB: Sequelize,
  ) {}

  async create(user): Promise<UserModel> {
    return await this.userRepository.create<UserModel>(user);
  }

  async findAll(): Promise<UserModel[]> {
    return await this.userRepository.findAll<UserModel>({
      attributes: { exclude: ['Password'] },
    });
  }

  async findOneById(id: string): Promise<UserModel> {
    return await this.userRepository.findOne<UserModel>({
      attributes: { exclude: ['Password'] },
      where: { id },
    });
  }

  async update(id: string, user): Promise<UserModel> {
    await this.userRepository.update<UserModel>(user, { where: { id } });
    return this.findOneById(id);
  }

  async delete(id: string): Promise<string> {
    await this.userRepository.destroy<UserModel>({ where: { id } });
    return 'user deleted';
  }

  async findAllActivity(): Promise<UserModel[]> {
    const result = await this.userRepository.findAll({
      attributes: ['id', 'name', 'email', 'user_id', 'user_type'],
      where: {
        User_Type: {
          [Op.in]: ['agent', 'Agent', 'AGENT'],
        },
      },
      include: [
        {
          model: this.chatActivityRepository,
          as: 'chatActivities',
        },
      ],
    });
    return result;
  }

  /**
   * Returns a paginated list of agent profiles with workload statistics and latest chat activity.
   */
  async getAgentProfileList(query: AgentProfileQueryDto): Promise<any> {
    try {
      const pageNum = Math.max(1, Number(query.page) || 1);
      const limitNum = Math.max(1, Math.min(100, Number(query.limit) || 15));
      const offset = (pageNum - 1) * limitNum;

      const whereClause: any = {
        User_Type: {
          [Op.in]: ['agent', 'Agent', 'AGENT'],
        },
      };

      if (query.search && query.search.trim()) {
        const search = query.search.trim();
        const searchConditions: any[] = [
          { Name: { [Op.like]: `%${search}%` } },
          { Email: { [Op.like]: `%${search}%` } },
          { User_Id: { [Op.like]: `%${search}%` } },
          { Phone_Number: { [Op.like]: `%${search}%` } },
        ];
        if (!isNaN(Number(search))) {
          searchConditions.push({ WhatsApp_Id: Number(search) });
        }
        whereClause[Op.and] = [{ [Op.or]: searchConditions }];
      }

      // Filter by agent workload status
      if (query.status && query.status.trim() && query.status.toLowerCase() !== 'all') {
        const norm = query.status.toLowerCase().trim();
        const activeAssigned = await this.chatActivityRepository.findAll({
          attributes: ['Agent_Id'],
          where: {
            Status: ChatActivityStatus.HUMAN_ACTIVE,
            Agent_Id: { [Op.ne]: null },
          },
          raw: true,
        });
        const activeAgentIds = Array.from(
          new Set(activeAssigned.map((a: any) => a.Agent_Id).filter(Boolean)),
        );

        if (norm === 'active' || norm === 'busy') {
          whereClause['Id'] = {
            [Op.in]: activeAgentIds,
          };
        } else if (norm === 'idle' || norm === 'available') {
          whereClause['Id'] = {
            [Op.notIn]: activeAgentIds,
          };
        }
      }

      const { rows: agents, count: total } =
        await this.userRepository.findAndCountAll({
          attributes: [
            'Id',
            'User_Id',
            'Name',
            'Email',
            'User_Type',
            'Phone_Number',
            'WhatsApp_Id',
          ],
          where: whereClause,
          offset,
          limit: limitNum,
          order: [['Name', 'ASC']],
        });

      if (!agents || agents.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 0,
          },
        };
      }

      const agentIds = agents.map((a) => a.Id);

      // Fetch chat activity stats and latest activities for these agents
      const activities = await this.chatActivityRepository.findAll({
        where: {
          Agent_Id: {
            [Op.in]: agentIds,
          },
        },
        include: [
          {
            model: this.customerRepository,
            as: 'customer',
            attributes: ['Id', 'Name', 'Phone_Number', 'WhatsApp_Id'],
            required: false,
          },
        ],
        order: [['Started_At', 'DESC']],
      });

      // Group activities by Agent_Id
      const activitiesByAgent = new Map<string, ChatActivityModel[]>();
      for (const act of activities) {
        const agId = act.Agent_Id;
        if (!activitiesByAgent.has(agId)) {
          activitiesByAgent.set(agId, []);
        }
        activitiesByAgent.get(agId).push(act);
      }

      const profileList = agents.map((agent) => {
        const agentActs = activitiesByAgent.get(agent.Id) || [];
        const totalAssignedChats = agentActs.length;
        const activeChats = agentActs.filter(
          (a) => Number(a.Status) === ChatActivityStatus.HUMAN_ACTIVE,
        ).length;
        const resolvedChats = agentActs.filter(
          (a) => Number(a.Status) === ChatActivityStatus.RESOLVED,
        ).length;

        const latestAct = agentActs[0] || null;

        return {
          id: agent.Id,
          user_id: agent.User_Id,
          name: agent.Name,
          email: agent.Email,
          phone_number: agent.Phone_Number,
          whatsapp_id: agent.WhatsApp_Id,
          user_type: agent.User_Type,
          workload_status: activeChats > 0 ? 'busy' : 'available',
          stats: {
            total_chats: totalAssignedChats,
            active_chats: activeChats,
            resolved_chats: resolvedChats,
          },
          latest_activity: latestAct
            ? {
                activity_id: latestAct.Activity_Id,
                status: latestAct.Status,
                status_label:
                  Number(latestAct.Status) === ChatActivityStatus.HUMAN_ACTIVE
                    ? 'human_active'
                    : 'resolved',
                started_at: latestAct.Started_At,
                human_takeover_at: latestAct.Human_Takeover_At,
                customer: latestAct.customer
                  ? {
                      id: latestAct.customer.Id,
                      name: latestAct.customer.Name,
                      phone_number: latestAct.customer.Phone_Number,
                    }
                  : null,
              }
            : null,
        };
      });

      return {
        success: true,
        data: profileList,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 0,
        },
      };
    } catch (error) {
      winstonLog.error(`Error in getAgentProfileList: ${error?.message || error}`);
      throw new BadRequestException('Failed to retrieve agent profile list');
    }
  }

  /**
   * Returns a single detailed agent profile by UUID or User_Id with assigned active chats.
   */
  async getAgentProfileById(id: string): Promise<any> {
    try {
      const agent = await this.userRepository.findOne({
        attributes: [
          'Id',
          'User_Id',
          'Name',
          'Email',
          'User_Type',
          'Phone_Number',
          'WhatsApp_Id',
        ],
        where: {
          [Op.and]: [
            {
              User_Type: {
                [Op.in]: ['agent', 'Agent', 'AGENT'],
              },
            },
            {
              [Op.or]: [{ Id: id }, { User_Id: id }, { Email: id }],
            },
          ],
        },
      });

      if (!agent) {
        throw new NotFoundException(`Agent with identifier ${id} not found`);
      }

      const activities = await this.chatActivityRepository.findAll({
        where: {
          Agent_Id: agent.Id,
        },
        include: [
          {
            model: this.customerRepository,
            as: 'customer',
            attributes: ['Id', 'Name', 'Phone_Number', 'WhatsApp_Id'],
            required: false,
          },
        ],
        order: [['Started_At', 'DESC']],
      });

      const totalChats = activities.length;
      const activeChats = activities.filter(
        (a) => Number(a.Status) === ChatActivityStatus.HUMAN_ACTIVE,
      );
      const resolvedChats = activities.filter(
        (a) => Number(a.Status) === ChatActivityStatus.RESOLVED,
      );

      return {
        success: true,
        data: {
          id: agent.Id,
          user_id: agent.User_Id,
          name: agent.Name,
          email: agent.Email,
          phone_number: agent.Phone_Number,
          whatsapp_id: agent.WhatsApp_Id,
          user_type: agent.User_Type,
          workload_status: activeChats.length > 0 ? 'busy' : 'available',
          stats: {
            total_chats: totalChats,
            active_chats: activeChats.length,
            resolved_chats: resolvedChats.length,
          },
          active_chats: activeChats.map((a) => ({
            activity_id: a.Activity_Id,
            status: a.Status,
            started_at: a.Started_At,
            human_takeover_at: a.Human_Takeover_At,
            customer: a.customer || null,
          })),
          recent_resolved_chats: resolvedChats.slice(0, 10).map((a) => ({
            activity_id: a.Activity_Id,
            status: a.Status,
            started_at: a.Started_At,
            human_takeover_at: a.Human_Takeover_At,
            customer: a.customer || null,
          })),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      winstonLog.error(`Error in getAgentProfileById: ${error?.message || error}`);
      throw new BadRequestException('Failed to retrieve agent profile');
    }
  }
}
