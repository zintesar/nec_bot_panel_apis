import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { ChatModel } from './chat.model';
import { UserModel } from './user.model';
import { CustomerModel } from './customer.model';

export enum ChatActivityStatus {
  WAITING = 0,
  RESOLVED = 1,
  AI_ACTIVE = 2,
  HUMAN_ACTIVE = 3,
}

export enum ChatActivityPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
}

@Table({
  tableName: 'Chat_Activity',
  schema: 'dbo',
  timestamps: false,
})
export class ChatActivityModel extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    allowNull: false,
    primaryKey: true,
    field: 'Activity_Id',
  })
  Activity_Id: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'Customer_Id',
  })
  Customer_Id: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'Agent_Id',
  })
  Agent_Id: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: true,
    comment: '0= waiting, 1= resolved, 2= ai active, 3= human active',
    field: 'Status',
  })
  Status: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
    allowNull: true,
    comment: '1= Low, 2= Medium, 3= High, 4= Urgent',
    field: 'Priority',
  })
  Priority: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'Started_At',
  })
  Started_At: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'Human_Takeover_At',
  })
  Human_Takeover_At: Date;

  @HasMany(() => ChatModel, {
    sourceKey: 'Activity_Id',
    foreignKey: 'Activity_Id',
    as: 'chats'
  })
  chats: ChatModel[];

  @HasOne(() => CustomerModel, {
    sourceKey: 'Customer_Id',
    foreignKey: 'Id',
    as: 'customer'
  })
  customer: CustomerModel;

  @HasOne(() => UserModel, {
    sourceKey: 'Agent_Id',
    foreignKey: 'Id',
    as: 'agent'
  })
  agent: UserModel;

}
