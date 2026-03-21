import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class NotificationPreference extends Model<
  InferAttributes<NotificationPreference>,
  InferCreationAttributes<NotificationPreference>
> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare email_enabled: CreationOptional<boolean>;
  declare inapp_enabled: CreationOptional<boolean>;
  declare email_document_expiring: CreationOptional<boolean>;
  declare email_document_expired: CreationOptional<boolean>;
  declare email_folder_complete: CreationOptional<boolean>;
  declare email_folder_verified: CreationOptional<boolean>;
  declare email_folder_viewed: CreationOptional<boolean>;
  declare email_folder_document_downloaded: CreationOptional<boolean>;
  declare email_new_folder_shared: CreationOptional<boolean>;
  declare email_subscription_alerts: CreationOptional<boolean>;
  declare weekly_digest_enabled: CreationOptional<boolean>;
  declare weekly_digest_day: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

NotificationPreference.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    inapp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_document_expiring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_document_expired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_folder_complete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_folder_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_folder_viewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    email_folder_document_downloaded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    email_new_folder_shared: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_subscription_alerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    weekly_digest_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    weekly_digest_day: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'notification_preferences',
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id'] }],
  }
);
