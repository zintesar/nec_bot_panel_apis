import { ChatActivityModel, ChatModel, UserModel } from '../../models';
import { CHAT_ACTIVITY_REPOSITORY, CHAT_REPOSITORY, USER_REPOSITORY } from '../../config/constants';

export const userProviders = [
  {
    provide: USER_REPOSITORY,
    useValue: UserModel,
  },
  {
    provide: CHAT_ACTIVITY_REPOSITORY,
    useValue: ChatActivityModel,
  },
  {
    provide: CHAT_REPOSITORY,
    useValue: ChatModel,
  },
];
