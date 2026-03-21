import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class SharingLink extends Model<
  InferAttributes<SharingLink>,
  InferCreationAttributes<SharingLink>
> {
  declare id: string;
  declare folder_id: number;
  declare context: CreationOptional<object | null>;
  declare expires_at: Date;
  declare revoked_at: CreationOptional<Date | null>;
  declare views_count: CreationOptional<number>;
  declare last_viewed_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SharingLink.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    folder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'folders', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    context: { type: DataTypes.JSON, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    views_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    last_viewed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'sharing_links',
    underscored: true,
    indexes: [{ fields: ['folder_id'] }, { fields: ['expires_at'] }, { fields: ['revoked_at'] }],
  }
);
