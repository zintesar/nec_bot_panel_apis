import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, USER_REPOSITORY } from '@config/constants';
import { ChatActivityModel, ChatModel, UserModel, ChatActivityStatus } from '@models/index';
import {
    Injectable,
    Inject,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    UnauthorizedException,
    HttpException,
} from '@nestjs/common';
import { IncomingMessageDto } from 'src/dto';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { winstonLog } from '@config/winstonLog';


@Injectable(

)
export class ChatActivityService {
    constructor(
        @Inject(CHAT_ACTIVITY_REPOSITORY) private readonly chatActivityRepository: typeof ChatActivityModel,
        @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof ChatModel,
        @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
    ) { }

    async handleIncomingMessage(incomingMessage: IncomingMessageDto): Promise<any> {

        const inbound_body = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "419561257915477",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "15550783881",
                                    "phone_number_id": "106540352242922"
                                },
                                "contacts": [
                                    {
                                        "profile": {
                                            "name": "Sheena Nelson"
                                        },
                                        "wa_id": "16505551234"
                                    }
                                ],
                                "messages": [
                                    {
                                        "from": "16505551234",
                                        "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
                                        "timestamp": "1749416383",
                                        "type": "text",
                                        "text": {
                                            "body": "Does it come in another color?"
                                        }
                                    }
                                ]
                            },
                            "field": "messages"
                        }
                    ]
                }
            ]
        }



        try {

            const customer_info = {
                phone_number: incomingMessage.entry[0].changes[0].value.metadata.display_phone_number,
                name: incomingMessage.entry[0].changes[0].value.contacts[0].profile.name,
                wa_id: parseInt(incomingMessage.entry[0].changes[0].value.contacts[0].wa_id),
            }

            const message_info = {
                message_id: incomingMessage.entry[0].changes[0].value.messages[0].id,
                message_type: incomingMessage.entry[0].changes[0].value.messages[0].type,
                message_timestamp: incomingMessage.entry[0].changes[0].value.messages[0].timestamp,
                message_text: incomingMessage.entry[0].changes[0].value.messages[0].text.body,
            }

            const activity_id = randomUUID()

            //check customer 
            let customer = await this.userRepository.findOne({
                where: {
                    Whatsapp_Id: customer_info.wa_id,
                },
            });

            if (!customer) {
                customer = await this.userRepository.create({
                    Id: randomUUID(),
                    Name: customer_info.name,
                    WhatsApp_Id: customer_info.wa_id,
                    Phone_Number: customer_info.phone_number,
                    User_Type: "customer"
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
                    Status: 0,
                    Started_At: new Date(),
                    Human_Takeover_At: null,
                });
            }


            const time_stamp = new Date(parseInt(message_info.message_timestamp) * 1000)



            const chat_entry = {
                Id: randomUUID(),
                Activity_Id: activity_id,
                Timestamp: new Date(parseInt(message_info.message_timestamp) * 1000),
                Type: message_info.message_type,
                Content: message_info.message_text,
                Message_Id: message_info.message_id,
            }

            const chat = await this.chatRepository.create(chat_entry);

            console.log("chat", chat)

            return chat


        } catch (error) {
            winstonLog.error(`error in processing message : ${error.message}`)
            throw new BadRequestException(error)
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
                            model: ChatModel,
                            as: 'chats',
                        },
                        {
                            model: UserModel,
                            as: 'customer',
                            attributes: ['Id', 'Name', 'Phone_Number', 'WhatsApp_Id'],
                        },
                        {
                            model: UserModel,
                            as: 'agent',
                            attributes: ['Id', 'Name', 'Email'],
                        },
                    ],
                })) ||
                (await this.chatActivityRepository.findByPk(chatActivityId, {
                    include: [
                        {
                            model: ChatModel,
                            as: 'chats',
                        },
                        {
                            model: UserModel,
                            as: 'customer',
                            attributes: ['Id', 'Name', 'Phone_Number', 'WhatsApp_Id'],
                        },
                        {
                            model: UserModel,
                            as: 'agent',
                            attributes: ['Id', 'Name', 'Email'],
                        },
                    ],
                }));

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

    async assignAgent(chatActivityId: string, agentId: string): Promise<any> {
        try {
            const chatActivity = await this.chatActivityRepository.findOne({
                where: {
                    Id: chatActivityId,
                },
            });

            if (!chatActivity) {
                return {
                    success: false,
                    message: 'Chat activity not found',
                };
            }

            chatActivity.Agent_Id = agentId;
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
            throw new BadRequestException("Failed to assign agent")
        }
    }



}
