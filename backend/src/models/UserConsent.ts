import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export type ConsentType = 'data_storage' | 'data_sharing' | 'ml_training';

export class UserConsent extends Model<
  InferAttributes<UserConsent>,
  InferCreationAttributes<UserConsent>
> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare consent_type: ConsentType;
  declare consented_at: CreationOptional<Date>;
  declare ip_address: CreationOptional<string | null>;
  declare user_agent: CreationOptional<string | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

UserConsent.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    consent_type: {
      type: DataTypes.ENUM('data_storage', 'data_sharing', 'ml_training'),
      allowNull: false,
    },
    consented_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ip_address: { type: DataTypes.STRING(64), allowNull: true },
    user_agent: { type: DataTypes.STRING(512), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'user_consents',
    underscored: true,
    indexes: [{ fields: ['user_id'] }],
  }
);
