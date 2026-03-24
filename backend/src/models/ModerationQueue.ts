import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class ModerationQueue extends Model<
  InferAttributes<ModerationQueue>,
  InferCreationAttributes<ModerationQueue>
> {
  declare id: CreationOptional<number>;
  declare folder_id: number;
  declare priority: CreationOptional<'low' | 'medium' | 'high' | 'critical'>;
  declare status: CreationOptional<'pending' | 'in_review' | 'validated' | 'rejected'>;
  declare assigned_to: CreationOptional<number | null>;
  declare ai_score_at_submission: number;
  declare motifs: object[];
  declare admin_notes: CreationOptional<string | null>;
  declare resolved_at: CreationOptional<Date | null>;
  declare resolved_by: CreationOptional<number | null>;
  declare resolution: CreationOptional<'approved' | 'rejected' | 'fraud_confirmed' | null>;
  declare adjusted_score: CreationOptional<number | null>;
  declare sla_deadline: Date;
  declare sla_breached: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

ModerationQueue.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    folder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      references: { model: 'folders', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_review', 'validated', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    ai_score_at_submission: { type: DataTypes.INTEGER, allowNull: false },
    motifs: { type: DataTypes.JSON, allowNull: false },
    admin_notes: { type: DataTypes.TEXT, allowNull: true },
    resolved_at: { type: DataTypes.DATE, allowNull: true },
    resolved_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    resolution: {
      type: DataTypes.ENUM('approved', 'rejected', 'fraud_confirmed'),
      allowNull: true,
    },
    adjusted_score: { type: DataTypes.INTEGER, allowNull: true },
    sla_deadline: { type: DataTypes.DATE, allowNull: false },
    sla_breached: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'moderation_queue',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['sla_deadline'] },
      { fields: ['assigned_to'] },
    ],
  }
);
