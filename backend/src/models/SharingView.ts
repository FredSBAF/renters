import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class SharingView extends Model<
  InferAttributes<SharingView>,
  InferCreationAttributes<SharingView>
> {
  declare id: CreationOptional<number>;
  declare sharing_link_id: string;
  declare agency_id: CreationOptional<number | null>;
  declare viewer_email: CreationOptional<string | null>;
  declare viewed_at: CreationOptional<Date>;
  declare ip_address: CreationOptional<string | null>;
  declare user_agent: CreationOptional<string | null>;
  declare documents_downloaded: CreationOptional<number[] | null>;
  declare access_level: CreationOptional<'limited' | 'full'>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SharingView.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    sharing_link_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'sharing_links', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    agency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    viewer_email: { type: DataTypes.STRING(255), allowNull: true },
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.STRING(500), allowNull: true },
    documents_downloaded: { type: DataTypes.JSON, allowNull: true },
    access_level: {
      type: DataTypes.ENUM('limited', 'full'),
      allowNull: false,
      defaultValue: 'limited',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'sharing_views',
    underscored: true,
    indexes: [
      { fields: ['sharing_link_id'] },
      { fields: ['agency_id'] },
      { fields: ['viewed_at'] },
    ],
  }
);
