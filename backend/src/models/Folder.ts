import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Folder extends Model<InferAttributes<Folder>, InferCreationAttributes<Folder>> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare status: CreationOptional<'incomplete' | 'complete' | 'verifying' | 'verified' | 'attention'>;
  declare completion_percentage: CreationOptional<number>;
  declare folder_status: CreationOptional<'active' | 'standby' | 'archived'>;
  declare ai_score_global: CreationOptional<number | null>;
  declare ai_score_identity: CreationOptional<number | null>;
  declare ai_score_income: CreationOptional<number | null>;
  declare ai_score_stability: CreationOptional<number | null>;
  declare ai_score_coherence: CreationOptional<number | null>;
  declare ai_status: CreationOptional<'pending' | 'analyzed' | 'manual_review' | 'rejected'>;
  declare ai_analyzed_at: CreationOptional<Date | null>;
  declare ai_warnings: CreationOptional<object[] | null>;
  declare expires_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
  declare folder_expiry_notified_at: CreationOptional<Date | null>;
}

Folder.init(
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
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('incomplete', 'complete', 'verifying', 'verified', 'attention'),
      allowNull: false,
      defaultValue: 'incomplete',
    },
    completion_percentage: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    folder_status: {
      type: DataTypes.ENUM('active', 'standby', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    ai_score_global: { type: DataTypes.INTEGER, allowNull: true },
    ai_score_identity: { type: DataTypes.INTEGER, allowNull: true },
    ai_score_income: { type: DataTypes.INTEGER, allowNull: true },
    ai_score_stability: { type: DataTypes.INTEGER, allowNull: true },
    ai_score_coherence: { type: DataTypes.INTEGER, allowNull: true },
    ai_status: {
      type: DataTypes.ENUM('pending', 'analyzed', 'manual_review', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    ai_analyzed_at: { type: DataTypes.DATE, allowNull: true },
    ai_warnings: { type: DataTypes.JSON, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    folder_expiry_notified_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'folders',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['folder_status'] },
      { fields: ['expires_at'] },
      { fields: ['deleted_at'] },
    ],
  }
);
