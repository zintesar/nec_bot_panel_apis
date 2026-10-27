import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

@Table({
  tableName: 'User_Type',
  schema: 'dbo',
  timestamps: false,
})
export class UserTypeModel extends Model {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
    field: 'Id',
  })
  Id: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'Name',
  })
  Name: string;
}
