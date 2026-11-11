import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
} from 'sequelize-typescript';
import { ChatActivityModel } from './chat-activity.model';

@Table({
  tableName: 'Users',
  schema: 'dbo',
  timestamps: false,
})
export class UserModel extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    allowNull: false,
    primaryKey: true,
    field: 'Id',
  })
  Id: string;

  @Column({
    type: DataType.STRING(30),
    allowNull: true,
    field: 'Name',
  })
  Name: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'Email',
  })
  Email: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'Password',
  })
  Password: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
    field: 'User_Type',
  })
  User_Type: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'Phone_Number',
  })
  Phone_Number: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    field: 'WhatsApp_Id',
  })
  WhatsApp_Id: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'User_Id',
  })
  User_Id: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
    allowNull: false,
    field: 'Token_Version',
  })
  Token_Version: number;

  @HasMany(() => ChatActivityModel, {
    sourceKey: 'Id',
    foreignKey: 'Agent_Id',
    as: 'chatActivities',
  })
  chatActivities: ChatActivityModel[];
}

