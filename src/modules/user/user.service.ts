import { Injectable, Inject } from '@nestjs/common';
import { ChatActivityModel, UserModel } from '../../models';
import { UserDto } from '../../dto';
import {
  USER_REPOSITORY,
  CHAT_ACTIVITY_REPOSITORY,
  DATABASE_CONNECTION,
  REDIS_CONNECTION,
} from '../../config/constants';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: typeof UserModel,
    @Inject(CHAT_ACTIVITY_REPOSITORY) private readonly chatActivityRepository: typeof ChatActivityModel,
    @Inject(DATABASE_CONNECTION) private DB: Sequelize,
    @Inject(REDIS_CONNECTION) private redisClient: any,
  ) { }

  async create(user): Promise<UserModel> {
    return await this.userRepository.create<UserModel>(user);
  }

  async findAll(): Promise<UserModel[]> {
    return await this.userRepository.findAll<UserModel>();
  }

  async findOneById(id: string): Promise<UserModel> {
    return await this.userRepository.findOne<UserModel>({ where: { id } });
  }

  async update(id: string, user): Promise<UserModel> {
    const result = await this.userRepository.update<UserModel>(user, { where: { id } });
    console.log('result', result)
    return this.findOneById(id);
  }

  async delete(id: string): Promise<string> {
    const result = await this.userRepository.destroy<UserModel>({ where: { id } });
    console.log('result', result)
    return 'user deleted';
  }

  async findAllActivity(): Promise<UserModel[]> {
    const result = await this.userRepository.findAll({
      attributes: ['id', 'name', 'email'],
      where: {
        User_Type: 'agent',
      },
      include: [
        {
          model: ChatActivityModel,
          as: 'chatActivities',
        },
      ],
    });
    return result;
  }


  // async findOneByEmail(email: string): Promise<UserModel> {
  //   return await this.userRepository.findOne<UserModel>({ where: { email } });
  // }

  // async callStoreProcedure(
  //   the_input_paramenters_required: string,
  // ): Promise<any> {
  //   // return await this.DB.query(`EXEC SW_PROC_CURRENCY @Flag = 'GetActiveList'`)
  //   // this.redisClient.setEx(`roblll`,3600, JSON.stringify({ll: 222}))

  //   const f = await this.redisClient.get('roblll');
  //   const fs = await this.redisClient.get('roblllex');

  //   // this.redisClient.set('roblll', JSON.stringify({ll: 2233332}))
  //   // this.redisClient.setEx(`roblllex`,3600, JSON.stringify({ll: 222}))

  //   console.log('f => ', f, ' fs => ', fs);
  // }
}
