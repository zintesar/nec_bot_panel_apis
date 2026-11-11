import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  ChatActivityModel,
  ChatActivityStatus,
  ChatModel,
  CustomerModel,
  UserModel,
} from '../../models';
import {
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  DATABASE_CONNECTION,
  USER_REPOSITORY,
} from '../../config/constants';
import {
  CreateCustomerDto,
  CustomerProfileQueryDto,
  UpdateCustomerDto,
} from '../../dto/customer.dto';
import { winstonLog } from '../../config/winstonLog';
import { randomUUID } from 'crypto';

@Injectable()
export class CustomerService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: typeof CustomerModel,
    @Inject(CHAT_ACTIVITY_REPOSITORY)
    private readonly chatActivityRepository: typeof ChatActivityModel,
    @Inject(CHAT_REPOSITORY)
    private readonly chatRepository: typeof ChatModel,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: typeof UserModel,
    @Inject(DATABASE_CONNECTION)
    private readonly DB: Sequelize,
  ) {}

  private getStatusLabel(status: number | null | undefined): string {
    switch (Number(status)) {
      case ChatActivityStatus.WAITING:
        return 'waiting';
      case ChatActivityStatus.RESOLVED:
        return 'resolved';
      case ChatActivityStatus.AI_ACTIVE:
        return 'ai_active';
      case ChatActivityStatus.HUMAN_ACTIVE:
        return 'human_active';
      default:
        return 'idle';
    }
  }

  /**
   * Returns a paginated list of customer profiles enriched with
   * chat statistics, latest activity, and recent message.
   */
  async getCustomerProfileList(query: CustomerProfileQueryDto): Promise<any> {
    try {
      const pageNum = Math.max(1, Number(query.page) || 1);
      const limitNum = Math.max(1, Math.min(100, Number(query.limit) || 15));
      const offset = (pageNum - 1) * limitNum;

      const whereClause: any = {};

      // Search keyword filter across Name, Phone_Number, and WhatsApp_Id
      if (query.search && query.search.trim()) {
        const search = query.search.trim();
        const searchConditions: any[] = [
          { Name: { [Op.like]: `%${search}%` } },
          { Phone_Number: { [Op.like]: `%${search}%` } },
        ];

        if (!isNaN(Number(search))) {
          searchConditions.push({ WhatsApp_Id: Number(search) });
        }

        whereClause[Op.or] = searchConditions;
      }

      // Status filter
      let customerIdFilter: string[] | null = null;
      if (query.status && query.status.trim() && query.status.toLowerCase() !== 'all') {
        const normalized = query.status.toLowerCase().trim();
        let targetStatuses: number[] = [];

        if (normalized === 'waiting') {
          targetStatuses = [ChatActivityStatus.WAITING];
        } else if (normalized === 'resolved') {
          targetStatuses = [ChatActivityStatus.RESOLVED];
        } else if (normalized === 'ai_active' || normalized === 'ai') {
          targetStatuses = [ChatActivityStatus.AI_ACTIVE];
        } else if (normalized === 'human_active' || normalized === 'agent_active' || normalized === 'agent') {
          targetStatuses = [ChatActivityStatus.HUMAN_ACTIVE];
        } else if (normalized === 'active') {
          targetStatuses = [
            ChatActivityStatus.WAITING,
            ChatActivityStatus.AI_ACTIVE,
            ChatActivityStatus.HUMAN_ACTIVE,
          ];
        }

        if (targetStatuses.length > 0) {
          const matchingActivities = await this.chatActivityRepository.findAll({
            attributes: ['Customer_Id'],
            where: {
              Status: {
                [Op.in]: targetStatuses,
              },
            },
            raw: true,
          });
          const ids = matchingActivities
            .map((a: any) => a.Customer_Id)
            .filter((id: string) => Boolean(id));
          customerIdFilter = Array.from(new Set(ids));
          whereClause['Id'] = {
            [Op.in]: customerIdFilter,
          };
        }
      }

      const { rows: customers, count: total } =
        await this.customerRepository.findAndCountAll({
          where: whereClause,
          offset,
          limit: limitNum,
          order: [['Id', 'DESC']],
        });

      if (!customers || customers.length === 0) {
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

      const customerIds = customers.map((c) => c.Id);

      // Fetch all chat activities for the current page customers
      const activities = await this.chatActivityRepository.findAll({
        where: {
          Customer_Id: {
            [Op.in]: customerIds,
          },
        },
        include: [
          {
            model: this.userRepository,
            as: 'agent',
            attributes: ['Id', 'User_Id', 'Name', 'Email'],
            required: false,
          },
        ],
        order: [['Started_At', 'DESC']],
      });

      // Group activities by Customer_Id
      const activitiesByCustomer = new Map<string, ChatActivityModel[]>();
      const latestActivityIds: string[] = [];

      for (const act of activities) {
        const custId = act.Customer_Id;
        if (!activitiesByCustomer.has(custId)) {
          activitiesByCustomer.set(custId, []);
          if (act.Activity_Id) {
            latestActivityIds.push(act.Activity_Id);
          }
        }
        activitiesByCustomer.get(custId).push(act);
      }

      // Fetch latest message for each latest activity
      const latestMessagesByActivity = new Map<string, ChatModel>();
      if (latestActivityIds.length > 0) {
        const chats = await this.chatRepository.findAll({
          where: {
            Activity_Id: {
              [Op.in]: latestActivityIds,
            },
          },
          order: [['Timestamp', 'DESC']],
        });

        for (const chat of chats) {
          if (!latestMessagesByActivity.has(chat.Activity_Id)) {
            latestMessagesByActivity.set(chat.Activity_Id, chat);
          }
        }
      }

      // Build customer profile models
      const profileList = customers.map((cust) => {
        const custActivities = activitiesByCustomer.get(cust.Id) || [];
        const totalChats = custActivities.length;
        const activeChats = custActivities.filter(
          (a) => Number(a.Status) !== ChatActivityStatus.RESOLVED,
        ).length;
        const resolvedChats = custActivities.filter(
          (a) => Number(a.Status) === ChatActivityStatus.RESOLVED,
        ).length;

        const latestAct = custActivities[0] || null;
        const latestMsg = latestAct
          ? latestMessagesByActivity.get(latestAct.Activity_Id) || null
          : null;

        const latestActivityData = latestAct
          ? {
              activity_id: latestAct.Activity_Id,
              status: latestAct.Status,
              status_label: this.getStatusLabel(latestAct.Status),
              started_at: latestAct.Started_At,
              human_takeover_at: latestAct.Human_Takeover_At,
              agent: latestAct.agent
                ? {
                    id: latestAct.agent.Id,
                    user_id: latestAct.agent.User_Id,
                    name: latestAct.agent.Name,
                    email: latestAct.agent.Email,
                  }
                : null,
            }
          : null;

        const lastMessageData = latestMsg
          ? {
              message_id: latestMsg.Message_Id,
              content: latestMsg.Content,
              type: latestMsg.Type,
              timestamp: latestMsg.Timestamp,
              from: latestMsg.From,
              to: latestMsg.To,
            }
          : null;

        return {
          id: cust.Id,
          name: cust.Name,
          phone_number: cust.Phone_Number,
          whatsapp_id: cust.WhatsApp_Id,
          stats: {
            total_chats: totalChats,
            active_chats: activeChats,
            resolved_chats: resolvedChats,
          },
          current_status: latestAct ? this.getStatusLabel(latestAct.Status) : 'idle',
          latest_activity: latestActivityData,
          last_message: lastMessageData,
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
      winstonLog.error(`Error in getCustomerProfileList: ${error?.message || error}`);
      throw new BadRequestException('Failed to retrieve customer profile list');
    }
  }

  /**
   * Returns a single detailed customer profile including complete chat activities.
   */
  async getCustomerProfileById(id: string): Promise<any> {
    try {
      const customer = await this.customerRepository.findOne({
        where: {
          [Op.or]: [
            { Id: id },
            { Phone_Number: id },
            ...(!isNaN(Number(id)) ? [{ WhatsApp_Id: Number(id) }] : []),
          ],
        },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with identifier ${id} not found`);
      }

      const activities = await this.chatActivityRepository.findAll({
        where: {
          Customer_Id: customer.Id,
        },
        include: [
          {
            model: this.userRepository,
            as: 'agent',
            attributes: ['Id', 'User_Id', 'Name', 'Email', 'Phone_Number'],
            required: false,
          },
          {
            model: this.chatRepository,
            as: 'chats',
            required: false,
          },
        ],
        order: [
          ['Started_At', 'DESC'],
          [{ model: this.chatRepository, as: 'chats' }, 'Timestamp', 'ASC'],
        ],
      });

      const totalChats = activities.length;
      const activeChats = activities.filter(
        (a) => Number(a.Status) !== ChatActivityStatus.RESOLVED,
      ).length;
      const resolvedChats = activities.filter(
        (a) => Number(a.Status) === ChatActivityStatus.RESOLVED,
      ).length;

      const latestActivity = activities[0] || null;

      return {
        success: true,
        data: {
          id: customer.Id,
          name: customer.Name,
          phone_number: customer.Phone_Number,
          whatsapp_id: customer.WhatsApp_Id,
          stats: {
            total_chats: totalChats,
            active_chats: activeChats,
            resolved_chats: resolvedChats,
          },
          current_status: latestActivity
            ? this.getStatusLabel(latestActivity.Status)
            : 'idle',
          latest_activity: latestActivity
            ? {
                activity_id: latestActivity.Activity_Id,
                status: latestActivity.Status,
                status_label: this.getStatusLabel(latestActivity.Status),
                started_at: latestActivity.Started_At,
                human_takeover_at: latestActivity.Human_Takeover_At,
                agent: latestActivity.agent || null,
              }
            : null,
          activities: activities.map((act) => ({
            activity_id: act.Activity_Id,
            status: act.Status,
            status_label: this.getStatusLabel(act.Status),
            started_at: act.Started_At,
            human_takeover_at: act.Human_Takeover_At,
            agent: act.agent || null,
            messages_count: act.chats ? act.chats.length : 0,
            chats: act.chats || [],
          })),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      winstonLog.error(`Error in getCustomerProfileById: ${error?.message || error}`);
      throw new BadRequestException('Failed to retrieve customer profile');
    }
  }

  async create(createDto: CreateCustomerDto): Promise<any> {
    try {
      const newCustomer = await this.customerRepository.create({
        Id: randomUUID(),
        Name: createDto.name,
        Phone_Number: createDto.phone_number || null,
        WhatsApp_Id: createDto.whatsapp_id ? Number(createDto.whatsapp_id) : null,
      });

      return {
        success: true,
        message: 'Customer created successfully',
        data: newCustomer,
      };
    } catch (error) {
      winstonLog.error(`Error creating customer: ${error?.message || error}`);
      throw new BadRequestException('Failed to create customer');
    }
  }

  async update(id: string, updateDto: UpdateCustomerDto): Promise<any> {
    try {
      const customer = await this.customerRepository.findOne({ where: { Id: id } });
      if (!customer) {
        throw new NotFoundException(`Customer with id ${id} not found`);
      }

      if (updateDto.name !== undefined) customer.Name = updateDto.name;
      if (updateDto.phone_number !== undefined) customer.Phone_Number = updateDto.phone_number;
      if (updateDto.whatsapp_id !== undefined) customer.WhatsApp_Id = Number(updateDto.whatsapp_id);

      await customer.save();

      return {
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      winstonLog.error(`Error updating customer: ${error?.message || error}`);
      throw new BadRequestException('Failed to update customer');
    }
  }

  async delete(id: string): Promise<any> {
    try {
      const deleted = await this.customerRepository.destroy({ where: { Id: id } });
      if (!deleted) {
        throw new NotFoundException(`Customer with id ${id} not found`);
      }
      return {
        success: true,
        message: 'Customer deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      winstonLog.error(`Error deleting customer: ${error?.message || error}`);
      throw new BadRequestException('Failed to delete customer');
    }
  }
}

