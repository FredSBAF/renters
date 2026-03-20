import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export type PaymentLogStatus = 'success' | 'failed' | 'pending';

export class PaymentLog extends Model<
  InferAttributes<PaymentLog>,
  InferCreationAttributes<PaymentLog>
> {
  declare id: CreationOptional<number>;
  declare agency_id: CreationOptional<number | null>;
  declare stripe_event_id: string;
  declare event_type: string;
  declare amount: CreationOptional<number | null>;
  declare currency: CreationOptional<string>;
  declare status: PaymentLogStatus;
  declare stripe_payload: CreationOptional<object | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

PaymentLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    agency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    stripe_event_id: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    event_type: { type: DataTypes.STRING(100), allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'eur' },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'pending'),
      allowNull: false,
      defaultValue: 'pending',
    },
    stripe_payload: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'payment_logs',
    underscored: true,
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['stripe_event_id'], unique: true },
      { fields: ['event_type'] },
    ],
  }
);
