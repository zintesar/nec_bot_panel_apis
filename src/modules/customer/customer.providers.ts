import {
  ChatActivityModel,
  ChatModel,
  CustomerModel,
  UserModel,
} from '../../models';
import {
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  USER_REPOSITORY,
} from '../../config/constants';

export const customerProviders = [
  {
    provide: CUSTOMER_REPOSITORY,
    useValue: CustomerModel,
  },
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
  },
];

