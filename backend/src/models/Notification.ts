import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare type: string;
  declare title: string;
  declare message: string;
  declare action_url: CreationOptional<string | null>;
  declare is_read: CreationOptional<boolean>;
  declare read_at: CreationOptional<Date | null>;
  declare email_sent: CreationOptional<boolean>;
  declare email_sent_at: CreationOptional<Date | null>;
  declare metadata: CreationOptional<object | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Notification.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    type: { type: DataTypes.STRING(100), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    action_url: { type: DataTypes.STRING(500), allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_at: { type: DataTypes.DATE, allowNull: true },
    email_sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    email_sent_at: { type: DataTypes.DATE, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id', 'is_read'] },
      { fields: ['user_id', 'created_at'] },
      { fields: ['type'] },
    ],
  }
);
