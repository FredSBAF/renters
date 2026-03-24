import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  declare id: CreationOptional<number>;
  declare user_id: CreationOptional<number | null>;
  declare agency_id: CreationOptional<number | null>;
  declare ip_address: CreationOptional<string | null>;
  declare action: string;
  declare entity_type: CreationOptional<string | null>;
  declare entity_id: CreationOptional<number | null>;
  declare details: CreationOptional<object | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    agency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: true },
    entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['agency_id'] },
      { fields: ['action'] },
      { fields: ['entity_type'] },
      { fields: ['created_at'] },
    ],
  }
);
