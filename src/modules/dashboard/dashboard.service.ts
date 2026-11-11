import {
  Injectable,
  Inject,
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
  AgentActivityQueryDto,
  AgentHeartbeatDto,
  ChatStatusQueryDto,
  CustomerGrowthQueryDto,
} from '../../dto/dashboard.dto';
import { winstonLog } from '../../config/winstonLog';

interface AgentPresenceRecord {
  lastSeen: number;
  explicitStatus?: string;
}

@Injectable()
export class DashboardService {
  // In-memory agent presence registry for heartbeats and live tracking
  private static agentPresenceMap = new Map<string, AgentPresenceRecord>();

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

  /**
   * Helper to format duration in seconds into a friendly string (e.g. "1h 12m 30s")
   */
  public formatDuration(totalSeconds: number): string {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Helper to calculate percentage growth between previous and current period.
   */
  private calculatePercentageGrowth(
    currentCount: number,
    previousCount: number,
  ): { percentage_change: number; trend: 'up' | 'down' | 'neutral' } {
    if (previousCount === 0 && currentCount === 0) {
      return { percentage_change: 0, trend: 'neutral' };
    }
    if (previousCount === 0) {
      return { percentage_change: 100, trend: 'up' };
    }
    const diff = currentCount - previousCount;
    const percentage = Number(((diff / previousCount) * 100).toFixed(2));
    const trend = percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'neutral';
    return { percentage_change: percentage, trend };
  }

  /**
   * 1. Customer Growth & Comparative Analysis
   * Total customers and % increase with respect to previous period (1 day, 7 days, 30 days, 1 year).
   */
  async getCustomerGrowth(query?: CustomerGrowthQueryDto): Promise<any> {
    try {
      const now = new Date();
      const nowTime = now.getTime();

      // Total lifetime unique customers
      const totalCustomers = await this.customerRepository.count();

      // Fetch customer acquisition timestamps via earliest chat activity
      // Query earliest interaction per customer within the last 730 days (2 years for 1 year comparison)
      const twoYearsAgo = new Date(nowTime - 730 * 24 * 60 * 60 * 1000);

      const firstActivities = await this.chatActivityRepository.findAll({
        attributes: [
          'Customer_Id',
          [Sequelize.fn('MIN', Sequelize.col('Started_At')), 'first_interaction'],
        ],
        where: {
          Started_At: {
            [Op.gte]: twoYearsAgo,
          },
          Customer_Id: {
            [Op.ne]: null,
          },
        },
        group: ['Customer_Id'],
        raw: true,
      });

      // Map acquisition timestamps
      const acquisitionTimestamps: number[] = firstActivities
        .map((a: any) => new Date(a.first_interaction || a.Started_At).getTime())
        .filter((t) => !isNaN(t));

      // Define time windows in milliseconds
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const SEVEN_DAYS = 7 * ONE_DAY;
      const THIRTY_DAYS = 30 * ONE_DAY;
      const ONE_YEAR = 365 * ONE_DAY;

      const periodsDef = [
        { key: '1_day', duration: ONE_DAY },
        { key: '7_days', duration: SEVEN_DAYS },
        { key: '30_days', duration: THIRTY_DAYS },
        { key: '1_year', duration: ONE_YEAR },
      ];

      const periodResults: Record<string, any> = {};

      for (const p of periodsDef) {
        const currentStart = nowTime - p.duration;
        const previousStart = nowTime - 2 * p.duration;

        let currentCount = 0;
        let previousCount = 0;

        for (const ts of acquisitionTimestamps) {
          if (ts >= currentStart && ts <= nowTime) {
            currentCount++;
          } else if (ts >= previousStart && ts < currentStart) {
            previousCount++;
          }
        }

        const { percentage_change, trend } = this.calculatePercentageGrowth(
          currentCount,
          previousCount,
        );

        periodResults[p.key] = {
          current_period_count: currentCount,
          previous_period_count: previousCount,
          percentage_change,
          trend,
        };
      }

      // If specific period is requested, return filtered or full object
      const requestedPeriod = (query?.period || 'all').toLowerCase().trim();
      const data =
        requestedPeriod !== 'all' && periodResults[requestedPeriod]
          ? {
              total_customers: totalCustomers,
              period: requestedPeriod,
              growth: periodResults[requestedPeriod],
            }
          : {
              total_customers: totalCustomers,
              periods: periodResults,
            };

      return {
        success: true,
        data,
      };
    } catch (error) {
      winstonLog.error(`Error in getCustomerGrowth: ${error?.message || error}`);
      throw new BadRequestException('Failed to calculate customer growth metrics');
    }
  }

  /**
   * 2. Chat Activity Pipeline Health
   * Total chat activity in waiting chats (status=0), AI progress (status=2), completed (status=1), human active (status=3).
   */
  async getChatStatusStats(query?: ChatStatusQueryDto): Promise<any> {
    try {
      const timeframe = (query?.timeframe || 'all').toLowerCase().trim();
      const whereClause: any = {};

      const now = new Date();
      if (timeframe === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        whereClause.Started_At = { [Op.gte]: startOfDay };
      } else if (timeframe === '7d' || timeframe === '7_days') {
        whereClause.Started_At = {
          [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };
      } else if (timeframe === '30d' || timeframe === '30_days') {
        whereClause.Started_At = {
          [Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
      }

      const groupedCounts = await this.chatActivityRepository.findAll({
        attributes: [
          'Status',
          [Sequelize.fn('COUNT', Sequelize.col('Activity_Id')), 'count'],
        ],
        where: whereClause,
        group: ['Status'],
        raw: true,
      });

      let waitingCount = 0;
      let completedCount = 0;
      let aiInProgressCount = 0;
      let humanActiveCount = 0;

      for (const item of groupedCounts as any[]) {
        const status = Number(item.Status);
        const count = Number(item.count) || 0;

        if (status === ChatActivityStatus.WAITING) {
          waitingCount = count;
        } else if (status === ChatActivityStatus.RESOLVED) {
          completedCount = count;
        } else if (status === ChatActivityStatus.AI_ACTIVE) {
          aiInProgressCount = count;
        } else if (status === ChatActivityStatus.HUMAN_ACTIVE) {
          humanActiveCount = count;
        }
      }

      const totalChats =
        waitingCount + completedCount + aiInProgressCount + humanActiveCount;
      const resolutionRate =
        totalChats > 0
          ? Number(((completedCount / totalChats) * 100).toFixed(2))
          : 0;

      return {
        success: true,
        data: {
          timeframe: timeframe || 'all',
          status_counts: {
            waiting: waitingCount,
            ai_in_progress: aiInProgressCount,
            human_active: humanActiveCount,
            completed: completedCount,
          },
          total_chats: totalChats,
          resolution_rate_percent: resolutionRate,
          breakdown: [
            {
              status: ChatActivityStatus.WAITING,
              name: 'waiting',
              count: waitingCount,
              percentage:
                totalChats > 0
                  ? Number(((waitingCount / totalChats) * 100).toFixed(2))
                  : 0,
            },
            {
              status: ChatActivityStatus.AI_ACTIVE,
              name: 'ai_in_progress',
              count: aiInProgressCount,
              percentage:
                totalChats > 0
                  ? Number(((aiInProgressCount / totalChats) * 100).toFixed(2))
                  : 0,
            },
            {
              status: ChatActivityStatus.HUMAN_ACTIVE,
              name: 'human_active',
              count: humanActiveCount,
              percentage:
                totalChats > 0
                  ? Number(((humanActiveCount / totalChats) * 100).toFixed(2))
                  : 0,
            },
            {
              status: ChatActivityStatus.RESOLVED,
              name: 'completed',
              count: completedCount,
              percentage:
                totalChats > 0
                  ? Number(((completedCount / totalChats) * 100).toFixed(2))
                  : 0,
            },
          ],
        },
      };
    } catch (error) {
      winstonLog.error(`Error in getChatStatusStats: ${error?.message || error}`);
      throw new BadRequestException('Failed to calculate chat activity statistics');
    }
  }

  /**
   * 3. Agent Activity
   * Agent list with presence status (online, offline, away), chat status (if actively assigned),
   * time started to interact with the chat, duration they interacted for.
   */
  async getAgentActivity(query?: AgentActivityQueryDto): Promise<any> {
    try {
      const search = query?.search?.trim();
      const statusFilter = (query?.status || 'all').toLowerCase().trim();

      const userWhere: any = {
        User_Type: {
          [Op.in]: ['agent', 'Agent', 'AGENT'],
        },
      };

      if (search) {
        userWhere[Op.and] = [
          {
            [Op.or]: [
              { Name: { [Op.like]: `%${search}%` } },
              { Email: { [Op.like]: `%${search}%` } },
              { User_Id: { [Op.like]: `%${search}%` } },
              { Phone_Number: { [Op.like]: `%${search}%` } },
            ],
          },
        ];
      }

      // Fetch all agent users
      const agents = await this.userRepository.findAll({
        attributes: [
          'Id',
          'User_Id',
          'Name',
          'Email',
          'User_Type',
          'Phone_Number',
          'WhatsApp_Id',
        ],
        where: userWhere,
        order: [['Name', 'ASC']],
      });

      if (!agents || agents.length === 0) {
        return {
          success: true,
          data: [],
          summary: {
            total_agents: 0,
            online_count: 0,
            busy_count: 0,
            available_count: 0,
            away_count: 0,
            offline_count: 0,
          },
        };
      }

      const agentIds = agents.map((a) => a.Id);

      // Fetch currently active chats assigned to these agents (Status = 3 HUMAN_ACTIVE)
      const activeChats = await this.chatActivityRepository.findAll({
        where: {
          Agent_Id: { [Op.in]: agentIds },
          Status: ChatActivityStatus.HUMAN_ACTIVE,
        },
        include: [
          {
            model: this.customerRepository,
            as: 'customer',
            attributes: ['Id', 'Name', 'Phone_Number', 'WhatsApp_Id'],
            required: false,
          },
        ],
        order: [['Human_Takeover_At', 'DESC']],
      });

      // Map active chat by Agent_Id
      const activeChatByAgent = new Map<string, ChatActivityModel>();
      for (const chat of activeChats) {
        if (!activeChatByAgent.has(chat.Agent_Id)) {
          activeChatByAgent.set(chat.Agent_Id, chat);
        }
      }

      // Fetch historical totals and today's resolved counts for each agent
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const agentHistory = await this.chatActivityRepository.findAll({
        attributes: [
          'Agent_Id',
          'Status',
          'Human_Takeover_At',
          'Started_At',
        ],
        where: {
          Agent_Id: { [Op.in]: agentIds },
        },
        raw: true,
      });

      const statsByAgent = new Map<
        string,
        {
          totalChats: number;
          todayResolved: number;
        }
      >();

      for (const h of agentHistory as any[]) {
        const agId = h.Agent_Id;
        if (!statsByAgent.has(agId)) {
          statsByAgent.set(agId, { totalChats: 0, todayResolved: 0 });
        }
        const st = statsByAgent.get(agId);
        st.totalChats++;

        if (
          Number(h.Status) === ChatActivityStatus.RESOLVED &&
          h.Human_Takeover_At &&
          new Date(h.Human_Takeover_At) >= startOfToday
        ) {
          st.todayResolved++;
        }
      }

      const nowTime = now.getTime();
      const FIVE_MINUTES = 5 * 60 * 1000;
      const THIRTY_MINUTES = 30 * 60 * 1000;

      let onlineCount = 0;
      let busyCount = 0;
      let availableCount = 0;
      let awayCount = 0;
      let offlineCount = 0;

      const agentActivityList = agents.map((agent) => {
        const activeChat = activeChatByAgent.get(agent.Id) || null;
        const isActivelyAssigned = Boolean(activeChat);

        // Presence determination
        const presenceRecord = DashboardService.agentPresenceMap.get(agent.Id);
        const lastSeen = presenceRecord ? presenceRecord.lastSeen : null;

        let presenceStatus: 'online' | 'away' | 'offline' = 'offline';
        let subStatus: 'busy' | 'available' | 'away' | 'offline' = 'offline';

        if (isActivelyAssigned) {
          presenceStatus = 'online';
          subStatus = 'busy';
        } else if (presenceRecord && presenceRecord.explicitStatus === 'away') {
          presenceStatus = 'away';
          subStatus = 'away';
        } else if (lastSeen && nowTime - lastSeen < FIVE_MINUTES) {
          presenceStatus = 'online';
          subStatus = 'available';
        } else if (lastSeen && nowTime - lastSeen < THIRTY_MINUTES) {
          presenceStatus = 'away';
          subStatus = 'away';
        } else {
          presenceStatus = 'offline';
          subStatus = 'offline';
        }

        // Increment summary counts
        if (presenceStatus === 'online') {
          onlineCount++;
          if (subStatus === 'busy') busyCount++;
          else availableCount++;
        } else if (presenceStatus === 'away') {
          awayCount++;
        } else {
          offlineCount++;
        }

        // Active interaction duration calculation
        let currentInteractionData: any = null;
        if (activeChat) {
          const takeoverTime = activeChat.Human_Takeover_At
            ? new Date(activeChat.Human_Takeover_At).getTime()
            : new Date(activeChat.Started_At).getTime();

          const elapsedSeconds = Math.max(0, Math.floor((nowTime - takeoverTime) / 1000));

          currentInteractionData = {
            activity_id: activeChat.Activity_Id,
            customer: activeChat.customer
              ? {
                  id: activeChat.customer.Id,
                  name: activeChat.customer.Name,
                  phone_number: activeChat.customer.Phone_Number,
                  whatsapp_id: activeChat.customer.WhatsApp_Id,
                }
              : null,
            started_at: activeChat.Started_At,
            interaction_started_at: activeChat.Human_Takeover_At || activeChat.Started_At,
            interaction_duration: {
              seconds: elapsedSeconds,
              formatted: this.formatDuration(elapsedSeconds),
            },
          };
        }

        const agentStats = statsByAgent.get(agent.Id) || {
          totalChats: 0,
          todayResolved: 0,
        };

        return {
          agent: {
            id: agent.Id,
            user_id: agent.User_Id,
            name: agent.Name,
            email: agent.Email,
            phone_number: agent.Phone_Number,
            whatsapp_id: agent.WhatsApp_Id,
          },
          presence: {
            status: presenceStatus,
            sub_status: subStatus,
            last_seen_at: lastSeen ? new Date(lastSeen) : null,
          },
          chat_status: {
            is_actively_assigned: isActivelyAssigned,
            active_chats_count: isActivelyAssigned ? 1 : 0,
            current_interaction: currentInteractionData,
          },
          historical_stats: {
            total_chats_handled: agentStats.totalChats,
            today_resolved_chats: agentStats.todayResolved,
          },
        };
      });

      // Filter by requested status if provided
      let filteredList = agentActivityList;
      if (statusFilter !== 'all') {
        if (statusFilter === 'online') {
          filteredList = agentActivityList.filter((a) => a.presence.status === 'online');
        } else if (statusFilter === 'busy') {
          filteredList = agentActivityList.filter((a) => a.presence.sub_status === 'busy');
        } else if (statusFilter === 'available') {
          filteredList = agentActivityList.filter((a) => a.presence.sub_status === 'available');
        } else if (statusFilter === 'away') {
          filteredList = agentActivityList.filter((a) => a.presence.status === 'away');
        } else if (statusFilter === 'offline') {
          filteredList = agentActivityList.filter((a) => a.presence.status === 'offline');
        }
      }

      return {
        success: true,
        data: filteredList,
        summary: {
          total_agents: agents.length,
          online_count: onlineCount,
          busy_count: busyCount,
          available_count: availableCount,
          away_count: awayCount,
          offline_count: offlineCount,
        },
      };
    } catch (error) {
      winstonLog.error(`Error in getAgentActivity: ${error?.message || error}`);
      throw new BadRequestException('Failed to retrieve agent activity metrics');
    }
  }

  /**
   * Records or updates agent client presence heartbeat.
   */
  async recordAgentHeartbeat(agentId: string, heartbeat: AgentHeartbeatDto): Promise<any> {
    const status = (heartbeat?.status || 'online').toLowerCase();
    DashboardService.agentPresenceMap.set(agentId, {
      lastSeen: Date.now(),
      explicitStatus: status === 'away' ? 'away' : 'online',
    });

    return {
      success: true,
      message: 'Agent heartbeat recorded',
      data: {
        agent_id: agentId,
        status,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Unified summary endpoint providing combined cards for initial dashboard rendering.
   */
  async getDashboardSummary(): Promise<any> {
    try {
      const [customersData, chatStatsData, agentActivityData] = await Promise.all([
        this.getCustomerGrowth({ period: 'all' }),
        this.getChatStatusStats({ timeframe: 'all' }),
        this.getAgentActivity({ status: 'all' }),
      ]);

      return {
        success: true,
        data: {
          customers: customersData.data,
          chat_pipeline: chatStatsData.data,
          agents_summary: agentActivityData.summary,
        },
      };
    } catch (error) {
      winstonLog.error(`Error in getDashboardSummary: ${error?.message || error}`);
      throw new BadRequestException('Failed to load dashboard summary');
    }
  }
}
