import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

@Table({
  tableName: 'Chats',
  schema: 'dbo',
  timestamps: false,
})
export class ChatModel extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    allowNull: false,
    primaryKey: true,
    field: 'Id',
  })
  Id: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'Activity_Id',
  })
  Activity_Id: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'Timestamp',
  })
  Timestamp: Date;

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
    field: 'Type',
  })
  Type: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'Content',
  })
  Content: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'Message_Id',
  })
  Message_Id: string;
}

export { ChatModel as Chat };
