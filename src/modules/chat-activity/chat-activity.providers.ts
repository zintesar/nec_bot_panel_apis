import { ChatActivityModel, ChatModel } from '@models/index';
import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY } from '@config/constants';

export const chatActivityProviders = [
  {
    provide: CHAT_ACTIVITY_REPOSITORY,
    useValue: ChatActivityModel,
  },
  {
    provide: CHAT_REPOSITORY,
    useValue: ChatModel,
  }
];
