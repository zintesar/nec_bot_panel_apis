import { ChatActivityModel, ChatModel, UserModel } from '@models/index';
import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, USER_REPOSITORY } from '@config/constants';

export const chatActivityProviders = [
  {
    provide: CHAT_ACTIVITY_REPOSITORY,
    useValue: ChatActivityModel,
  },
  {
    provide: CHAT_REPOSITORY,
    useValue: ChatModel,
  },
  {
    provide: USER_REPOSITORY,
    useValue: UserModel,
  }
];
