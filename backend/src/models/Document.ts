import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Document extends Model<InferAttributes<Document>, InferCreationAttributes<Document>> {
  declare id: CreationOptional<number>;
  declare folder_id: number;
  declare document_type: string;
  declare file_path: string;
  declare file_name: string;
  declare file_size: number;
  declare mime_type: string;
  declare extracted_text: CreationOptional<string | null>;
  declare extracted_data: CreationOptional<object | null>;
  declare status: CreationOptional<'pending_analysis' | 'valid' | 'invalid' | 'expired' | 'attention'>;
  declare issued_at: CreationOptional<string | null>;
  declare expires_at: CreationOptional<string | null>;
  declare ai_score: CreationOptional<number | null>;
  declare ai_warnings: CreationOptional<object[] | null>;
  declare ai_metadata: CreationOptional<object | null>;
  declare comment: CreationOptional<string | null>;
  declare expiry_notified_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

Document.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    folder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'folders', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    document_type: { type: DataTypes.STRING(50), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    extracted_text: { type: DataTypes.TEXT, allowNull: true },
    extracted_data: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending_analysis', 'valid', 'invalid', 'expired', 'attention'),
      allowNull: false,
      defaultValue: 'pending_analysis',
    },
    issued_at: { type: DataTypes.DATEONLY, allowNull: true },
    expires_at: { type: DataTypes.DATEONLY, allowNull: true },
    ai_score: { type: DataTypes.INTEGER, allowNull: true },
    ai_warnings: { type: DataTypes.JSON, allowNull: true },
    ai_metadata: { type: DataTypes.JSON, allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    expiry_notified_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'documents',
    underscored: true,
    paranoid: true,
    timestamps: true,
    indexes: [
      { fields: ['folder_id'] },
      { fields: ['document_type'] },
      { fields: ['status'] },
      { fields: ['expires_at'] },
      { fields: ['deleted_at'] },
    ],
  }
);
