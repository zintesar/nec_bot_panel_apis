import { UserModel } from '../../models';
import { USER_REPOSITORY } from '../../config/constants';

export const userProviders = [
  {
    provide: USER_REPOSITORY,
    useValue: UserModel,
  },
];
