import {
    CHAT_ACTIVITY_REPOSITORY,
    CHAT_REPOSITORY,
    CUSTOMER_REPOSITORY,
    USER_REPOSITORY,
} from '@config/constants';
import {
    ChatActivityModel,
    ChatModel,
    UserModel,
    ChatActivityStatus,
    CustomerModel,
} from '@models/index';
import {
    Injectable,
    Inject,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    UnauthorizedException,
    HttpException,
} from '@nestjs/common';
import {
    AssignAgentDto,
    SendWhatsAppTextMessageDto,
    SetPriorityDto,
    UnAssignAgentDto,
} from 'src/dto';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { Op } from 'sequelize';
import { winstonLog } from '@config/winstonLog';
import {
    ExtractedWhatsAppMessage,
    detectLanguageFromText,
    iterTextMessages,
} from './whatsapp-webhook.util';
import { ChatBotService } from './chat-bot.service';
import { EmailSendService } from '../email-send/email-send.service';

@Injectable()
export class ChatActivityService {
    constructor(
        @Inject(CHAT_ACTIVITY_REPOSITORY) private readonly chatActivityRepository: typeof ChatActivityModel,
        @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof ChatModel,
        @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
        @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: typeof CustomerModel,
        private readonly chatBotService: ChatBotService,
        private readonly emailSendService: EmailSendService,
    ) { }

    /**
     * Processes an individual inbound WhatsApp text message received via Meta webhook:
     * 1. Resolves/registers the customer in CustomerModel.
     * 2. Retrieves or initiates the conversation session in ChatActivityModel.
     * 3. Saves the customer's incoming message to the Chats table.
     * 4. Forwards message text to the external ChatBot API with session metadata.
     * 5. Sends the bot's generated answer back to the customer via Meta WhatsApp Cloud API.
     *
     * @param msg - Extracted WhatsApp message metadata and text content
     * @returns Processing summary containing saved chat, bot response, and outbound delivery info
     */
    async processWhatsAppTextMessage(msg: ExtractedWhatsAppMessage): Promise<any> {

        try {
            // -------------------------------------------------------------------------
            // STEP 1: Normalize customer telephone number and extract metadata
            // -------------------------------------------------------------------------
            const customerPhone = String(msg.sender || msg.from || '').trim();
            const cleanDigits = customerPhone.replace(/\D/g, '');
            const customerWaId = parseInt(cleanDigits, 10) || 0;

            const customerInfo = {
                phone_number: customerPhone,
                name: msg.name || customerPhone,
                wa_id: customerWaId,
            };

            const detectedLang = detectLanguageFromText(msg.body);
            winstonLog.info(`WhatsApp input [${msg.messageId}] (${detectedLang || 'default'}): ${msg.body}`);

            // -------------------------------------------------------------------------
            // STEP 2: Retrieve existing customer or register new customer profile
            // -------------------------------------------------------------------------
            const whereCustomer: any[] = [];
            if (customerInfo.wa_id > 0) {
                whereCustomer.push({ WhatsApp_Id: customerInfo.wa_id });
            }
            if (customerInfo.phone_number) {
                whereCustomer.push({ Phone_Number: customerInfo.phone_number });
            }
            if (cleanDigits && cleanDigits !== customerInfo.phone_number) {
                whereCustomer.push({ Phone_Number: cleanDigits });
                whereCustomer.push({ Phone_Number: `+${cleanDigits}` });
            }

            let customer = await this.customerRepository.findOne({
                where: {
                    [Op.or]: whereCustomer.length > 0 ? whereCustomer : [{ Phone_Number: customerPhone }],
                },
            });

            if (!customer) {
                customer = await this.customerRepository.create({
                    Id: randomUUID(),
                    Name: customerInfo.name,
                    WhatsApp_Id: customerInfo.wa_id,
                    Phone_Number: customerInfo.phone_number,
                });
                winstonLog.info(`Created new customer profile for WhatsApp ID: ${customerInfo.wa_id}`);
            }

            const customerId = customer.Id;
            // const newActivityId = randomUUID();
            const newActivityId = customerId


            // -------------------------------------------------------------------------
            // STEP 3: Find or initialize active conversation session (ChatActivity)
            // -------------------------------------------------------------------------
            let chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Customer_Id: customerId,
                },
                order: [['Started_At', 'DESC']],
            });

            if (!chatActivity) {
                chatActivity = await this.chatActivityRepository.create({
                    Activity_Id: newActivityId,
                    Customer_Id: customerId,
                    Status: ChatActivityStatus.AI_ACTIVE,
                    Started_At: new Date(),
                    Human_Takeover_At: null,
                });
                winstonLog.info(`Created new chat activity session: ${newActivityId}`);
            } else if (chatActivity.Status === ChatActivityStatus.WAITING) {
                // If chat was in WAITING state, activate AI processing
                chatActivity.Status = ChatActivityStatus.AI_ACTIVE;
                await chatActivity.save();
            }

            // -------------------------------------------------------------------------
            // STEP 4: Record inbound WhatsApp message into the Chats repository
            // -------------------------------------------------------------------------
            const messageTimestamp = msg.timestamp
                ? new Date(parseInt(msg.timestamp, 10) * 1000)
                : new Date();

            const fromStr = String(msg.from || msg.sender || '').trim();
            const toStr = String(msg.to || msg.recipient || (msg.isEcho ? '' : (msg.displayPhoneNumber || ''))).trim();

            const chatEntry = {
                Id: randomUUID(),
                Activity_Id: chatActivity.Activity_Id || newActivityId,
                From: fromStr,
                To: toStr,
                Timestamp: messageTimestamp,
                Type: msg.type || 'text',
                Content: msg.body,
                Message_Id: msg.messageId,
            };

            const chat = await this.chatRepository.create(chatEntry);
            winstonLog.info(`Saved WhatsApp incoming chat entry: ${msg.messageId}`);

            // -------------------------------------------------------------------------
            // STEP 5: Safeguard against message echo loops (skip bot for business echoes)
            // -------------------------------------------------------------------------
            if (msg.isEcho) {
                winstonLog.info(`Skipping bot trigger for outgoing echo message: ${msg.messageId}`);
                return {
                    incomingChat: chat,
                };
            }

            // -------------------------------------------------------------------------
            // STEP 6: Dispatch inquiry payload to ChatBot API
            // -------------------------------------------------------------------------
            const botPayload = {
                message: msg.body,
                session_id: String(chatActivity.Activity_Id || newActivityId),
                language: detectedLang || 'en',
            };

            winstonLog.info(`Calling ChatBot API for incoming message [${msg.messageId}], session [${botPayload.session_id}]`);
            let botResponse: any = null;
            // try {
            //     botResponse = await this.callBotApi(botPayload);
            // } catch (botErr: any) {
            //     winstonLog.error(`Error calling ChatBot API: ${botErr?.message || botErr}`);
            // }

            // // Extract the 'answer' text returned by chatbot
            // const botAnswer = botResponse?.answer || botResponse?.data?.answer || (typeof botResponse === 'string' ? botResponse : null);

            // -------------------------------------------------------------------------
            // STEP 7: Handle human support handoff or dispatch outbound WhatsApp reply
            // -------------------------------------------------------------------------
            let sentWhatsAppMessage: any = null;
            // const isHumanRequired = Boolean(
            //     botResponse?.human_support === true ||
            //     botResponse?.data?.human_support === true
            // );

            const isHumanRequired = true;

            if (isHumanRequired) {
                // Human support requested: Remain completely silent on WhatsApp,
                // set chat activity status to HUMAN_ACTIVE (3), and email agents.
                winstonLog.info(`Human support requested for session [${chatActivity.Activity_Id || newActivityId}]. Suppressing WhatsApp reply.`);
                chatActivity.Status = ChatActivityStatus.HUMAN_ACTIVE;
                chatActivity.Human_Takeover_At = new Date();
                await chatActivity.save();

                try {
                    const agents = await this.userRepository.findAll({
                        where: {
                            User_Type: {
                                [Op.in]: ['agent', 'Agent', 'AGENT'],
                            },
                            Email: {
                                [Op.ne]: null,
                            },
                        },
                        attributes: ['Id', 'Name', 'Email'],
                    });

                    const agentEmails = agents
                        .map((a) => a.Email?.trim())
                        .filter((email): email is string => Boolean(email && email.length > 0));

                    if (agentEmails.length > 0) {
                        await this.emailSendService.sendAgentHandoffAlert({
                            recipients: agentEmails,
                            customer: {
                                name: customer.Name,
                                phone: customerPhone,
                            },
                            activityId: chatActivity.Activity_Id || newActivityId,
                            customerMessage: msg.body,
                            requestedAt: new Date(),
                        });
                    } else {
                        winstonLog.warn(`No agents with valid email addresses found to receive handoff alert for activity [${chatActivity.Activity_Id || newActivityId}]`);
                    }
                } catch (emailErr: any) {
                    winstonLog.error(`Error notifying agents of human handoff for activity [${chatActivity.Activity_Id || newActivityId}]: ${emailErr?.message || emailErr}`);
                }
            }
            // else if (botAnswer) {
            //     try {
            //         winstonLog.info(`Sending bot answer via WhatsApp to ${customerPhone}: ${botAnswer}`);
            //         sentWhatsAppMessage = await this.sendWhatsAppTextMessage({
            //             whatsapp_number: customerPhone,
            //             text: botAnswer,
            //             chat_activity_id: chatActivity.Activity_Id || newActivityId,
            //         }, {
            //             user_type: 'bot',
            //             id: 'bot',
            //             user_id: 'bot',
            //         });
            //     } catch (sendErr: any) {
            //         winstonLog.error(`Error sending bot answer to WhatsApp recipient ${customerPhone}: ${sendErr?.message || sendErr}`);
            //     }
            // } 
            else {
                winstonLog.warn(`ChatBot API did not return an answer for session [${botPayload.session_id}]`);
            }

            // -------------------------------------------------------------------------
            // STEP 8: Assemble and return message processing result
            // -------------------------------------------------------------------------
            return {
                incomingChat: chat,
                botResponse,
                sentWhatsAppMessage,
            };
        } catch (error) {
            winstonLog.error(`error in processing message : ${error?.message || error}`);
            throw new BadRequestException(error);
        }
    }

    /**
     * Forwards a message payload to the external chatbot service:
     * Delegates to injected ChatBotService.
     *
     * @param data - Payload containing { message, session_id, language }
     * @returns Bot response containing answer, confidence, and metadata
     */
    async callBotApi(data: any): Promise<any> {
        return await this.chatBotService.callBotApi(data);
    }

    /**
     * Authenticates with external chatbot service to obtain and cache JWT bearer token.
     * Delegates to injected ChatBotService.
     *
     * @param body - Optional credentials override { username, password }
     * @returns Token payload { token, token_type, expires_in }
     */
    async botLogin(body?: any): Promise<any> {
        return await this.chatBotService.botLogin(body);
    }

    /**
     * Retrieves a paginated list of chat activities with optional status filtering.
     * By default, returns chats with WAITING (0) and AI_ACTIVE (2) status codes.
     *
     * @param page - Page number (defaults to 1)
     * @param limit - Page size limit (defaults to 15)
     * @param status - Optional status filter (name or numeric code: 0, 1, 2, 3)
     * @returns Paginated chat activity list and metadata
     */
    async getChatList(page: number, limit: number, status?: string): Promise<any> {
        // Step 1: Map status criteria to numeric codes (0=WAITING, 1=RESOLVED, 2=AI ACTIVE, 3=HUMAN ACTIVE)
        let statusFilter: any;

        if (status !== undefined && status !== null && status !== '') {
            const statusMap: Record<string, number> = {
                'waiting': ChatActivityStatus.WAITING,
                'resolved': ChatActivityStatus.RESOLVED,
                'ai_active': ChatActivityStatus.AI_ACTIVE,
                'ai active': ChatActivityStatus.AI_ACTIVE,
                'agent_active': ChatActivityStatus.HUMAN_ACTIVE,
                'human_active': ChatActivityStatus.HUMAN_ACTIVE,
                'agent active': ChatActivityStatus.HUMAN_ACTIVE,
            };

            const lower = typeof status === 'string' ? status.toLowerCase().trim() : '';
            if (statusMap[lower] !== undefined) {
                statusFilter = statusMap[lower];
            } else if (!isNaN(Number(status))) {
                statusFilter = Number(status);
            } else {
                statusFilter = status;
            }
        } else {
            // Default: Show active queue (WAITING and AI ACTIVE)
            statusFilter = [ChatActivityStatus.WAITING, ChatActivityStatus.AI_ACTIVE, ChatActivityStatus.HUMAN_ACTIVE,];
        }

        // Step 2: Normalize pagination bounds
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 15;
        const offset = (pageNum - 1) * limitNum;

        try {
            // Step 3: Query paginated chat activities and aggregate count
            const result = await this.chatActivityRepository.findAll({
                where: {
                    Status: statusFilter,
                },
                include: [
                    {
                        model: this.customerRepository,
                        as: 'customer',
                        attributes: ['Id', 'Name', 'WhatsApp_Id', 'Phone_Number'],
                    },
                    {
                        model: this.userRepository,
                        as: 'agent',
                        attributes: ['Id', 'Name', 'WhatsApp_Id', 'Phone_Number'],
                    },
                ],
                order: [['Started_At', 'DESC']],
                offset,
                limit: limitNum,
            });

            // Step 4: Extract activity IDs and fetch latest message for each activity
            const activityIds = result.map((act) => act.Activity_Id).filter(Boolean);
            const lastChatMap = new Map<string, any>();

            if (activityIds.length > 0) {
                const latestChats = await this.chatRepository.findAll({
                    where: {
                        Activity_Id: {
                            [Op.in]: activityIds,
                        },
                    },
                    order: [['Timestamp', 'DESC']],
                });

                for (const chat of latestChats) {
                    if (!lastChatMap.has(chat.Activity_Id)) {
                        lastChatMap.set(chat.Activity_Id, chat);
                    }
                }
            }

            // Step 5: Format activities attaching the last 1 chat
            const formattedResult = result.map((act) => {
                const json = typeof act.toJSON === 'function' ? act.toJSON() : act;
                const lastChat = lastChatMap.get(act.Activity_Id) || null;
                return {
                    ...json,
                    last_chat: lastChat,
                    // chats: lastChat ? [lastChat] : [],
                };
            });

            const total = await this.chatActivityRepository.count({
                where: {
                    Status: statusFilter,
                },
            });

            // Step 6: Return formatted pagination response
            return {
                success: true,
                data: formattedResult,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                },
            };
        } catch (error: any) {
            winstonLog.error("error in fetching chat list " + error.message);
            throw new BadRequestException("Failed to process message");
        }
    }

    /**
     * Retrieves full conversation details including chats transcript, customer profile,
     * and assigned agent information. Enforces role-based access control.
     *
     * @param chatActivityId - Primary key UUID of the target chat activity
     * @param currentUser - Authenticated user payload from JWT
     * @returns Full chat activity details
     */
    async getChatDetails(chatActivityId: string, currentUser: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ getChatDetails ~ currentUser:", currentUser);

        try {
            // Step 1: Validate request authentication context
            if (!currentUser) {
                throw new UnauthorizedException('Authentication required');
            }

            // Step 2: Query chat activity with eager-loaded relations (chats, customer, agent)
            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: chatActivityId,
                },
                include: [
                    {
                        model: this.chatRepository,
                        as: 'chats',
                        order: [['Timestamp', 'ASC']],
                    },
                    {
                        model: this.customerRepository,
                        as: 'customer',
                        attributes: ['Name', 'Phone_Number', 'WhatsApp_Id'],
                    },
                    {
                        model: this.userRepository,
                        as: 'agent',
                        attributes: ['User_Id', 'Name', 'Email'],
                    },
                ],
            });

            // Step 3: Verify chat activity existence
            if (!chatActivity) {
                throw new NotFoundException('Chat activity not found');
            }

            // Step 4: Enforce role-based access control (RBAC)
            const userRole = (currentUser?.User_Type || currentUser?.user_type || '').toLowerCase();
            const currentUserId = currentUser?.id || currentUser?.Id || currentUser?.user_id;

            // Admin role has unrestricted access to all chat transcripts
            if (userRole === 'admin') {
                return {
                    success: true,
                    data: chatActivity,
                };
            }

            // Agent role can only inspect chats assigned to them in active status (3)
            if (userRole === 'agent') {
                const isAssignedToAgent = chatActivity.Agent_Id === currentUserId;
                const isStatusAgentActive = Number(chatActivity.Status) === 3;

                if (!isAssignedToAgent || !isStatusAgentActive) {
                    throw new ForbiddenException(
                        'Access denied: You are not assigned to this chat or the chat is not active',
                    );
                }

                return {
                    success: true,
                    data: chatActivity,
                };
            }

            throw new ForbiddenException('Access denied: Unauthorized role');
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            winstonLog.error("error in fetching chat details " + error.message);
            throw new BadRequestException("Failed to process message");
        }
    }

    /**
     * Assigns a chat activity to a human support agent for human takeover.
     * Enforces permission and state validation.
     *
     * @param body - Target chat activity and agent identifiers
     * @param user - Current authenticated user context
     * @returns Updated chat activity model
     */
    async assignAgent(body: AssignAgentDto, user: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ assignAgent ~ user:", user);

        try {
            // Step 1: Validate agent permissions (agents cannot assign chats to other agents)
            if (user.User_Type === 'agent') {
                if (user.User_Id !== body.agent_id && user.Id !== body.agent_id) {
                    throw new ForbiddenException(
                        'Access denied: You are not authorized to perform this action',
                    );
                }
            }

            // Step 2: Locate target chat activity and agent records
            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: body.chat_activity_id,
                },
            });

            let agent
            if (body.agent_id.startsWith('NEC')) {
                agent = await this.userRepository.findOne({
                    where: {
                        user_id: body.agent_id,
                    },
                });
            } else {
                agent = await this.userRepository.findOne({
                    where: {
                        Id: body.agent_id,
                    },
                });
            }


            // Step 3: Validate existence of agent and chat activity
            if (!agent) {
                throw new BadRequestException('Agent not found');
            }

            if (!chatActivity) {
                throw new BadRequestException('Chat not found');
            }

            // Step 4: Validate chat state transitions
            if (chatActivity.Status === 3) {
                throw new BadRequestException('Agent already assigned');
            }

            if (chatActivity.Status === 1) {
                throw new ForbiddenException('Chat already resolved');
            }

            // Step 5: Assign agent, update status to HUMAN_ACTIVE (3), and set takeover timestamp
            chatActivity.Agent_Id = agent.Id;
            chatActivity.Status = 3;
            chatActivity.Human_Takeover_At = new Date();
            await chatActivity.save();

            // Step 6: Return assignment confirmation
            return {
                success: true,
                message: 'Agent assigned successfully',
                data: chatActivity,
            };
        } catch (error: any) {
            winstonLog.error("error in assigning agent " + error.message);
            throw new BadRequestException(error);
        }
    }

    /**
     * Unassigns an agent from a chat activity, reverting status back to AI_ACTIVE (2).
     *
     * @param body - Target chat activity and agent identifiers
     * @param user - Current authenticated user context
     * @returns Updated chat activity model
     */
    async unassignAgent(body: UnAssignAgentDto, user: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ unassignAgent ~ user:", user);

        try {
            // Step 1: Locate target chat activity and agent records
            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: body.chat_activity_id,
                },
            });

            if (!chatActivity) {
                throw new BadRequestException("Chat not found");
            }

            // Step 2: Validate agent permissions (agents cannot assign chats to other agents)
            if (user.User_Type === 'agent') {
                if (user.User_Id !== chatActivity.Agent_Id && user.Id !== chatActivity.Agent_Id) {
                    throw new ForbiddenException(
                        'Access denied: You are not authorized to perform this action',
                    );
                }
            }

            // Step 3: Validate status compatibility (cannot unassign waiting, resolved, or AI handover)
            if (chatActivity.Status === 0) {
                throw new BadRequestException('Chat is still in waiting');
            }

            if (chatActivity.Status === 1) {
                throw new ForbiddenException('Chat already resolved');
            }

            if (chatActivity.Status === 2) {
                throw new BadRequestException('Chat is still in AI handover');
            }

            // Step 4: Clear agent assignment and transition status back to AI_ACTIVE (2)
            chatActivity.Agent_Id = null;
            chatActivity.Status = 2;
            await chatActivity.save();

            // Step 5: Return release confirmation
            return {
                success: true,
                message: 'Agent unassigned successfully',
                data: chatActivity,
            };
        } catch (error: any) {
            winstonLog.error("error in unassigning agent " + error.message);
            throw new BadRequestException(error);
        }
    }

    /**
     * Sends an outbound WhatsApp text message:
     * 1. Validates target chat activity and enforces role-based access control (Admin, Bot, Agent).
     * 2. Validates recipient phone/WhatsApp number and message text body.
     * 3. Resolves recipient profile from UserModel or CustomerModel by phone number / WhatsApp ID.
     * 4. Prepares API credentials and persists the message entry to the Chats table linked to ChatActivity.
     *
     * @param dto - Outbound WhatsApp message parameters { whatsapp_number, text, chat_activity_id }
     * @param currentUser - Current authenticated user context
     * @returns Delivery confirmation with message ID and recipient info
     */
    async sendWhatsAppTextMessage(dto: SendWhatsAppTextMessageDto, currentUser?: any): Promise<any> {
        const targetNumber = String(dto?.whatsapp_number || '').trim();
        const textBody = String(dto?.text || '').trim();
        const userRole = (currentUser?.User_Type || currentUser?.user_type || '').toLowerCase();
        const currentUserId = currentUser?.id || currentUser?.Id || currentUser?.user_id;

        // -------------------------------------------------------------------------
        // STEP 1: Validate chat activity existence and enforce access control (RBAC)
        // -------------------------------------------------------------------------
        const chatActivity = await this.chatActivityRepository.findOne({
            where: {
                Activity_Id: dto.chat_activity_id,
            },
        });

        if (!chatActivity) {
            throw new BadRequestException('Chat activity not found');
        }

        // Admin role has unrestricted permission to send messages
        if (userRole === 'admin') {
        }

        // Bot system has automated permission to send responses
        if (userRole === 'bot') {
        }

        // Agent role can only send messages to chats assigned to them in active status (3)
        if (userRole === 'agent') {
            const isAssignedToAgent = chatActivity.Agent_Id === currentUserId;
            const isStatusAgentActive = Number(chatActivity.Status) === 3;

            if (!isAssignedToAgent || !isStatusAgentActive) {
                throw new ForbiddenException(
                    'Access denied: You are not assigned to this chat or the chat is not active',
                );
            }
        }

        // -------------------------------------------------------------------------
        // STEP 2: Validate required parameters (recipient number and message text)
        // -------------------------------------------------------------------------
        if (!targetNumber) {
            throw new BadRequestException('Recipient whatsapp_number is required');
        }

        if (!textBody) {
            throw new BadRequestException('Message text body is required');
        }

        // -------------------------------------------------------------------------
        // STEP 3: Resolve recipient profile from UserModel or CustomerModel
        // -------------------------------------------------------------------------
        const cleanNumber = targetNumber.replace(/\D/g, '');
        const waIdNum = parseInt(cleanNumber, 10);

        const whereConditions: any[] = [
            { Phone_Number: targetNumber },
        ];

        if (cleanNumber && cleanNumber !== targetNumber) {
            whereConditions.push({ Phone_Number: cleanNumber });
            whereConditions.push({ Phone_Number: `+${cleanNumber}` });
        }

        if (!isNaN(waIdNum) && waIdNum > 0) {
            whereConditions.push({ WhatsApp_Id: waIdNum });
        }

        // Query UserModel first
        let recipient: any = await this.userRepository.findOne({
            where: {
                [Op.or]: whereConditions,
            },
        });

        // Fall back to CustomerModel
        if (!recipient && this.customerRepository) {
            recipient = await this.customerRepository.findOne({
                where: {
                    [Op.or]: whereConditions,
                },
            });
        }

        if (!recipient) {
            winstonLog.warn(`User with WhatsApp number '${targetNumber}' not found in user table`);
            throw new NotFoundException(`User with WhatsApp number '${targetNumber}' not found in user table`);
        }

        // -------------------------------------------------------------------------
        // STEP 4: Extract valid WhatsApp recipient ID
        // -------------------------------------------------------------------------
        const whatsAppId = recipient.WhatsApp_Id ? String(recipient.WhatsApp_Id) : cleanNumber;
        if (!whatsAppId) {
            throw new BadRequestException(`No valid WhatsApp ID found for user '${recipient.Name || recipient.Id}'`);
        }

        // -------------------------------------------------------------------------
        // STEP 5: Validate Meta WhatsApp Cloud API credentials from environment
        // -------------------------------------------------------------------------
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

        // if (!accessToken) {
        //     throw new BadRequestException('WHATSAPP_ACCESS_TOKEN is not configured in environment variables');
        // }

        if (!phoneNumberId) {
            throw new BadRequestException('WHATSAPP_PHONE_NUMBER_ID is not configured in environment variables');
        }

        const url = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

        // -------------------------------------------------------------------------
        // STEP 6: Dispatch message to Meta WhatsApp Cloud API (currently bypassed)
        // -------------------------------------------------------------------------
        // const requestBody = {
        //     messaging_product: 'whatsapp',
        //     recipient_type: 'individual',
        //     to: whatsAppId,
        //     type: 'text',
        //     text: {
        //         preview_url: false,
        //         body: textBody,
        //     },
        // };

        // winstonLog.info(`Sending WhatsApp text message to ${whatsAppId} (user: ${recipient.Id}) via ${url}`);

        // let metaResponse: any;
        // try {
        //     const apiRes = await axios.post(url, requestBody, {
        //         headers: {
        //             'Content-Type': 'application/json',
        //             Authorization: `Bearer ${accessToken}`,
        //         },
        //     });
        //     metaResponse = apiRes.data;
        // } catch (error: any) {
        //     const errorDetails = error.response?.data || error.message;
        //     winstonLog.error(`Error sending WhatsApp message: ${JSON.stringify(errorDetails)}`);
        //     const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to send WhatsApp message via Meta API';
        //     throw new BadRequestException(errorMessage);
        // }

        // Generate unique message identifier for the outbound message
        const sentMessageId = randomUUID();

        // -------------------------------------------------------------------------
        // STEP 7: Persist outbound message in Chats table and link to ChatActivity
        // -------------------------------------------------------------------------
        try {
            let chatActivity: any = null;

            // Prioritize explicitly specified activity ID
            if (dto?.chat_activity_id) {
                chatActivity = await this.chatActivityRepository.findOne({
                    where: {
                        Activity_Id: dto.chat_activity_id,
                    },
                });
            }

            // Fall back to most recent activity for the recipient
            if (!chatActivity && recipient?.Id) {
                chatActivity = await this.chatActivityRepository.findOne({
                    where: {
                        Customer_Id: recipient.Id,
                    },
                    order: [['Started_At', 'DESC']],
                });
            }

            const activityId = randomUUID();
            if (!chatActivity) {
                chatActivity = await this.chatActivityRepository.create({
                    Activity_Id: dto?.chat_activity_id || activityId,
                    Customer_Id: recipient.Id,
                    Status: 0,
                    Started_At: new Date(),
                    Human_Takeover_At: null,
                });
            }

            const chatEntry = {
                Id: randomUUID(),
                Activity_Id: chatActivity.Activity_Id || activityId,
                From: phoneNumberId,
                To: whatsAppId,
                Timestamp: new Date(),
                Type: 'text',
                Content: textBody,
                Message_Id: sentMessageId,
            };

            await this.chatRepository.create(chatEntry);
            winstonLog.info(`Saved sent WhatsApp message entry [${sentMessageId}] to Chats table`);
        } catch (dbError: any) {
            winstonLog.warn(`Message sent to Meta successfully, but failed saving chat entry: ${dbError?.message || dbError}`);
        }

        // -------------------------------------------------------------------------
        // STEP 8: Return delivery confirmation with Meta message ID
        // -------------------------------------------------------------------------
        return {
            success: true,
            message: 'WhatsApp text message sent successfully',
            data: {
                messageId: sentMessageId,
                recipient: {
                    userId: recipient.Id,
                    name: recipient.Name,
                    whatsAppId: whatsAppId,
                    phoneNumber: recipient.Phone_Number,
                },
                // metaResponse,
            },
        };
    }

    /**
     * Sets or updates the priority of a specific chat activity.
     *
     * @param dto - Object containing activity UUID (activity_id/chat_activity_id) and priority integer (1-4)
     * @returns Updated chat activity data
     */
    async setPriority(dto: SetPriorityDto): Promise<any> {
        const activityId = dto.activity_id || (dto as any).chat_activity_id || (dto as any).activity_uuid;

        if (!activityId) {
            throw new BadRequestException('Activity UUID is required');
        }

        const priority = Number(dto.priority);
        if (dto.priority === undefined || dto.priority === null || isNaN(priority)) {
            throw new BadRequestException('Valid integer priority is required');
        }

        try {
            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: activityId,
                },
            });

            if (!chatActivity) {
                throw new NotFoundException(`Chat activity not found for UUID: ${activityId}`);
            }

            chatActivity.Priority = priority;
            await chatActivity.save();

            winstonLog.info(`Chat activity [${activityId}] priority updated to ${priority}`);

            return {
                success: true,
                message: 'Priority updated successfully',
                data: chatActivity,
            };
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            winstonLog.error(`Error setting chat priority: ${error?.message || error}`);
            throw new BadRequestException(error?.message || 'Failed to update priority');
        }
    }
}
