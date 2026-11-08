import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, CUSTOMER_REPOSITORY, USER_REPOSITORY } from '@config/constants';
import { ChatActivityModel, ChatModel, UserModel, ChatActivityStatus, CustomerModel } from '@models/index';
import {
    Injectable,
    Inject,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    UnauthorizedException,
    HttpException,
} from '@nestjs/common';
import { AssignAgentDto, IncomingMessageDto, SendWhatsAppTextMessageDto } from 'src/dto';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { Op } from 'sequelize';
import { winstonLog } from '@config/winstonLog';
import {
    ExtractedWhatsAppMessage,
    detectLanguageFromText,
    iterTextMessages,
} from './whatsapp-webhook.util';

@Injectable()
export class ChatActivityService {
    constructor(
        @Inject(CHAT_ACTIVITY_REPOSITORY) private readonly chatActivityRepository: typeof ChatActivityModel,
        @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof ChatModel,
        @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
        @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: typeof CustomerModel,
    ) { }

    async processWhatsAppTextMessage(msg: ExtractedWhatsAppMessage): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ processWhatsAppTextMessage ~ msg:", msg)
        try {
            const customer_info = {
                phone_number: msg.displayPhoneNumber || msg.sender,
                name: msg.name || msg.sender,
                wa_id: parseInt(msg.sender) || 0,
            };

            const detectedLang = detectLanguageFromText(msg.body);
            winstonLog.info(`WhatsApp input [${msg.messageId}] (${detectedLang || 'default'}): ${msg.body}`);

            const activity_id = randomUUID();

            // check customer 
            let customer = await this.customerRepository.findOne({
                where: {
                    WhatsApp_Id: customer_info.wa_id,
                },
            });

            if (!customer) {
                customer = await this.customerRepository.create({
                    Id: randomUUID(),
                    Name: customer_info.name,
                    WhatsApp_Id: customer_info.wa_id,
                    Phone_Number: customer_info.phone_number,
                });
            }

            const customer_id = customer.Id;

            // check activity 
            let chat_activity = await this.chatActivityRepository.findOne({
                where: {
                    Customer_Id: customer_id,
                },
            });

            if (!chat_activity) {
                chat_activity = await this.chatActivityRepository.create({
                    Activity_Id: customer_id,
                    Customer_Id: customer_id,
                    Status: 0,
                    Started_At: new Date(),
                    Human_Takeover_At: null,
                });
            }

            const messageTimestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

            const fromStr = String(msg.from || msg.sender || '').trim();
            const toStr = String(msg.to || msg.recipient || (msg.isEcho ? '' : (msg.displayPhoneNumber || ''))).trim();

            const chat_entry = {
                Id: randomUUID(),
                Activity_Id: chat_activity.Activity_Id || activity_id,
                From: fromStr,
                To: toStr,
                Timestamp: messageTimestamp,
                Type: msg.type,
                Content: msg.body,
                Message_Id: msg.messageId,
            };

            const chat = await this.chatRepository.create(chat_entry);
            winstonLog.info(`Saved WhatsApp incoming chat entry: ${msg.messageId}`);
            return chat;
        } catch (error) {
            winstonLog.error(`error in processing message : ${error?.message || error}`);
            throw new BadRequestException(error);
        }
    }

    async handleIncomingMessage(incomingMessage: any): Promise<any> {
        try {
            const messages = iterTextMessages(incomingMessage);
            if (!messages || messages.length === 0) {
                winstonLog.info('Received WhatsApp webhook without text messages (e.g. delivery receipt, status, or non-text)');
                return { status: 'ignored_or_no_text' };
            }

            const results = [];
            for (const msg of messages) {
                const res = await this.processWhatsAppTextMessage(msg);
                results.push(res);
            }
            return results.length === 1 ? results[0] : results;
        } catch (error) {
            winstonLog.error(`error in processing message : ${error?.message || error}`);
            throw new BadRequestException(error);
        }
    }

    async callBotApi(data) {

        const url = process.env.CALL_BOT_API_URL;
        const key = process.env.CALL_BOT_API_KEY;

        const headers = {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${key}`,
        };

        winstonLog.info(`calling nec bot api on url: ${url}`)
        winstonLog.info(`calling nec bot api with body: ${data}`)

        let response;
        try {
            response = await axios.post(
                url,
                data,
                { headers: headers }
            )

            winstonLog.info(`call nec bot api success`)
            winstonLog.info(`call nec bot api response: ${response}`)

        } catch (error) {
            winstonLog.error(`Error calling nec bot api on url: ${url}`)
            winstonLog.error(`Error calling nec bot api with body: ${data}`)
            winstonLog.error(`Error calling nec bot api with error: ${error}`)
            return error
        }

        const result = response.data

        console.log("result", result)

        return result;


    }

    async handelOutgoingMessage(outgoingMessage: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ handelOutgoingMessage ~ outgoingMessage:", JSON.stringify(outgoingMessage))

        const outbound_body = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "102290129340398",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "15550783881",
                                    "phone_number_id": "106540352242922"
                                },
                                "message_echoes": [
                                    {
                                        "from": "15550783881",
                                        "to": "16505551234",
                                        "id": "wamid.HBgLMTY0NjcwNDM1OTUVAgARGBIyNDlBOEI5QUQ4NDc0N0FCNjMA",
                                        "timestamp": "1739321024",
                                        "type": "text",
                                        "text": {
                                            "body": "Here's the info you requested! https://www.meta.com/quest/quest-3/"
                                        }
                                    }
                                ]
                            },
                            "field": "smb_message_echoes"
                        }
                    ]
                }
            ]
        }

        try {

            const customer_info = {
                phone_number: outgoingMessage.entry[0].changes[0].value.metadata.display_phone_number,
                name: outgoingMessage.entry[0].changes[0].value.contacts[0].profile.name,
                wa_id: outgoingMessage.entry[0].changes[0].value.contacts[0].wa_id,
            }

            const message_info = {
                message_id: outgoingMessage.entry[0].changes[0].value.messages[0].id,
                message_type: outgoingMessage.entry[0].changes[0].value.messages[0].type,
                message_timestamp: outgoingMessage.entry[0].changes[0].value.messages[0].timestamp,
                message_text: outgoingMessage.entry[0].changes[0].value.messages[0].text.body,
            }

            const activity_id = randomUUID()

            //check customer 
            let customer = await this.userRepository.findOne({
                where: {
                    wa_id: customer_info.wa_id,
                },
            });

            if (!customer) {
                customer = await this.userRepository.create({
                    Id: randomUUID(),
                    Name: customer_info.name,
                    WhatsApp_Id: customer_info.wa_id,
                    Phone_Number: customer_info.phone_number,
                });
            }

            const customer_id = customer.Id

            // check activity 
            let chat_activity = await this.chatActivityRepository.findOne({
                where: {
                    customer_id: customer_id,
                },
            });

            if (!chat_activity) {
                chat_activity = await this.chatActivityRepository.create({
                    Id: activity_id,
                    Customer_Id: customer_id,
                    Status: "WAITING",
                    Started_At: new Date(),
                    Human_Takeover_At: null,
                });
            }


            const time_stamp = new Date(parseInt(message_info.message_timestamp) * 1000)



            const chat_entry = {
                Id: randomUUID(),
                Activity_Id: activity_id,
                From: customer_info.phone_number,
                To: String(customer_info.wa_id),
                Timestamp: new Date(parseInt(message_info.message_timestamp) * 1000),
                Type: message_info.message_type,
                Content: message_info.message_text,
                Message_Id: message_info.message_id,
            }

            const chat = await this.chatRepository.create(chat_entry);

            console.log("chat", chat)

        } catch (error) {
            return {
                success: false,
                message: 'Failed to process message',
                error: error.message,
            };
        }

    }

    async getChatList(page: number, limit: number, status?: string): Promise<any> {
        // statuses: 0 = WAITING, 1 = RESOLVED, 2 = AI ACTIVE, 3 = AGENT ACTIVE
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
            // By default show chats with WAITING (0) and AI ACTIVE (2)
            statusFilter = [ChatActivityStatus.WAITING, ChatActivityStatus.AI_ACTIVE];
        }

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 15;

        try {
            const result = await this.chatActivityRepository.findAll({
                where: {
                    Status: statusFilter,
                },
                offset: (pageNum - 1) * limitNum,
                limit: limitNum,
            });

            const total = await this.chatActivityRepository.count({
                where: {
                    Status: statusFilter,
                },
            });

            return {
                success: true,
                data: result,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                },
            };
        }
        catch (error) {
            winstonLog.error("error in fetching chat list " + error.message);
            throw new BadRequestException("Failed to process message");
        }

    }

    async getChatDetails(chatActivityId: string, currentUser: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ getChatDetails ~ currentUser:", currentUser)
        try {
            if (!currentUser) {
                throw new UnauthorizedException('Authentication required');
            }

            const chatActivity =
                (await this.chatActivityRepository.findOne({
                    where: {
                        Activity_Id: chatActivityId,
                    },
                    include: [
                        {
                            model: this.chatRepository,
                            as: 'chats',
                            order: [
                                ['Timestamp', 'ASC']
                            ]
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
                }))

            if (!chatActivity) {
                throw new NotFoundException('Chat activity not found');
            }

            const userRole = (currentUser?.User_Type || currentUser?.user_type || '').toLowerCase();
            const currentUserId = currentUser?.id || currentUser?.Id || currentUser?.user_id;

            if (userRole === 'admin') {
                return {
                    success: true,
                    data: chatActivity,
                };
            }

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
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            winstonLog.error("error in fetching chat details " + error.message);
            throw new BadRequestException("Failed to process message");
        }
    }

    async assignAgent(body: AssignAgentDto, user: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ assignAgent ~ user:", user)



        try {

            //check user is admin or agent
            if (user.User_Type == 'agent') {

                if (user.User_Id != body.agent_id) {
                    throw new ForbiddenException(
                        'Access denied: You are not authorized to perform this action',
                    );
                }
            }

            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: body.chat_activity_id,
                },
            });

            const agent = await this.userRepository.findOne({
                where: {
                    User_Id: body.agent_id,
                },
            });

            if (!agent) {
                throw new BadRequestException('Agent not found')
            }

            if (!chatActivity) {
                throw new BadRequestException('Chat not found')
            }

            if (chatActivity.Status == 3) {
                throw new BadRequestException('Agent already assigned')
            }

            if (chatActivity.Status == 1) {
                throw new ForbiddenException('Chat already resolved')
            }

            chatActivity.Agent_Id = agent.Id;
            chatActivity.Status = 3;
            chatActivity.Human_Takeover_At = new Date();
            await chatActivity.save();

            return {
                success: true,
                message: 'Agent assigned successfully',
                data: chatActivity,
            }
        }
        catch (error) {
            winstonLog.error("error in assigning agent " + error.message)
            throw new BadRequestException(error)
        }
    }

    async unassignAgent(body: AssignAgentDto, user: any): Promise<any> {
        console.log("🚀 ~ ChatActivityService ~ unassignAgent ~ user:", user)
        try {

            //check user is admin or agent
            if (user.User_Type == 'agent') {

                if (user.User_Id != body.agent_id) {
                    throw new ForbiddenException(
                        'Access denied: You are not authorized to perform this action',
                    );
                }
            }

            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Activity_Id: body.chat_activity_id,
                },
            });

            if (!chatActivity) {
                return {
                    success: false,
                    message: 'Chat activity not found',
                };
            }

            if (chatActivity.Status == 0) {
                throw new BadRequestException('Chat is still in waiting')
            }


            if (chatActivity.Status == 1) {
                throw new ForbiddenException('Chat already resolved')
            }

            if (chatActivity.Status == 2) {
                throw new BadRequestException('Chat is still in AI handover')
            }

            chatActivity.Agent_Id = null;
            chatActivity.Status = 2;
            await chatActivity.save();

            return {
                success: true,
                message: 'Agent unassigned successfully',
                data: chatActivity,
            }
        }
        catch (error) {
            winstonLog.error("error in unassigning agent " + error.message)
            throw new BadRequestException(error)
        }
    }

    /**
     * Sends an outbound WhatsApp text message via Meta Cloud API.
     * Searches UserModel using the provided WhatsApp/phone number to retrieve the WhatsApp ID,
     * dispatches the message via WhatsApp Send Message API, and persists the entry into Chats table.
     */
    async sendWhatsAppTextMessage(dto: SendWhatsAppTextMessageDto): Promise<any> {
        const targetNumber = String(dto?.whatsapp_number || dto?.phone_number || '').trim();
        const textBody = String(dto?.text || dto?.message || '').trim();

        if (!targetNumber) {
            throw new BadRequestException('Recipient whatsapp_number is required');
        }

        if (!textBody) {
            throw new BadRequestException('Message text body is required');
        }

        // 1. Search for user in UserModel by phone number or WhatsApp ID
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

        const user = await this.userRepository.findOne({
            where: {
                [Op.or]: whereConditions,
            },
        });

        if (!user) {
            winstonLog.warn(`User with WhatsApp number '${targetNumber}' not found in user table`);
            throw new NotFoundException(`User with WhatsApp number '${targetNumber}' not found in user table`);
        }

        // 2. Pick up the WhatsApp ID
        const whatsAppId = user.WhatsApp_Id ? String(user.WhatsApp_Id) : cleanNumber;
        if (!whatsAppId) {
            throw new BadRequestException(`No valid WhatsApp ID found for user '${user.Name || user.Id}'`);
        }

        // 3. Configure WhatsApp Cloud API credentials
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

        if (!accessToken) {
            throw new BadRequestException('WHATSAPP_ACCESS_TOKEN is not configured in environment variables');
        }

        if (!phoneNumberId) {
            throw new BadRequestException('WHATSAPP_PHONE_NUMBER_ID is not configured in environment variables');
        }

        const url = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

        const requestBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: whatsAppId,
            type: 'text',
            text: {
                preview_url: false,
                body: textBody,
            },
        };

        winstonLog.info(`Sending WhatsApp text message to ${whatsAppId} (user: ${user.Id}) via ${url}`);

        let metaResponse;
        try {
            const apiRes = await axios.post(url, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            metaResponse = apiRes.data;
        } catch (error) {
            const errorDetails = error.response?.data || error.message;
            winstonLog.error(`Error sending WhatsApp message: ${JSON.stringify(errorDetails)}`);
            const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to send WhatsApp message via Meta API';
            throw new BadRequestException(errorMessage);
        }

        const sentMessageId = metaResponse?.messages?.[0]?.id || randomUUID();

        // 4. Save outgoing chat entry in database
        try {
            let chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Customer_Id: user.Id,
                },
            });

            const activityId = randomUUID();
            if (!chatActivity) {
                chatActivity = await this.chatActivityRepository.create({
                    Activity_Id: activityId,
                    Customer_Id: user.Id,
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
        } catch (dbError) {
            winstonLog.warn(`Message sent to Meta successfully, but failed saving chat entry: ${dbError?.message || dbError}`);
        }

        return {
            success: true,
            message: 'WhatsApp text message sent successfully',
            data: {
                messageId: sentMessageId,
                recipient: {
                    userId: user.Id,
                    name: user.Name,
                    whatsAppId: whatsAppId,
                    phoneNumber: user.Phone_Number,
                },
                metaResponse,
            },
        };
    }
}
