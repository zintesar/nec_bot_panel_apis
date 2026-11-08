import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

@Table({
  tableName: 'Customer',
  schema: 'dbo',
  timestamps: false,
})
export class CustomerModel extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    allowNull: true,
    primaryKey: true,
    field: 'Id',
  })
  Id: string;

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
    type: DataType.TEXT,
    allowNull: true,
    field: 'Name',
  })
  Name: string;
}

export { CustomerModel as Customer };

