import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, USER_REPOSITORY } from '@config/constants';
import { ChatActivityModel, ChatModel, UserModel } from '@models/index';
import { Injectable, Inject } from '@nestjs/common';
import { IncomingMessageDto } from 'src/dto';
import { randomUUID } from 'crypto';


@Injectable(

)
export class ChatActivityService {
    constructor(
        @Inject(CHAT_ACTIVITY_REPOSITORY) private readonly chatActivityRepository: typeof ChatActivityModel,
        @Inject(CHAT_REPOSITORY) private readonly chatRepository: typeof ChatModel,
        @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
    ) { }

    async handleIncomingMessage(incomingMessage: IncomingMessageDto): Promise<any> {

        // const body = {
        //     "object": "whatsapp_business_account",
        //     "entry": [
        //         {
        //             "id": "419561257915477",
        //             "changes": [
        //                 {
        //                     "value": {
        //                         "messaging_product": "whatsapp",
        //                         "metadata": {
        //                             "display_phone_number": "15550783881",
        //                             "phone_number_id": "106540352242922"
        //                         },
        //                         "contacts": [
        //                             {
        //                                 "profile": {
        //                                     "name": "Sheena Nelson"
        //                                 },
        //                                 "wa_id": "16505551234"
        //                             }
        //                         ],
        //                         "messages": [
        //                             {
        //                                 "from": "16505551234",
        //                                 "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
        //                                 "timestamp": "1749416383",
        //                                 "type": "text",
        //                                 "text": {
        //                                     "body": "Does it come in another color?"
        //                                 }
        //                             }
        //                         ]
        //                     },
        //                     "field": "messages"
        //                 }
        //             ]
        //         }
        //     ]
        // }

        try {

            const customer_info = {
                phone_number: incomingMessage.entry[0].changes[0].value.metadata.display_phone_number,
                name: incomingMessage.entry[0].changes[0].value.contacts[0].profile.name,
                wa_id: incomingMessage.entry[0].changes[0].value.contacts[0].wa_id,
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
}
