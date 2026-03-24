import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Guarantor extends Model<
  InferAttributes<Guarantor>,
  InferCreationAttributes<Guarantor>
> {
  declare id: CreationOptional<number>;
  declare tenant_id: number;
  declare guarantor_user_id: CreationOptional<number | null>;
  declare role: CreationOptional<'guarantor' | 'co_tenant' | 'spouse'>;
  declare first_name: CreationOptional<string | null>;
  declare last_name: CreationOptional<string | null>;
  declare email: CreationOptional<string | null>;
  declare phone: CreationOptional<string | null>;
  declare folder_id: CreationOptional<number | null>;
  declare invitation_token: CreationOptional<string | null>;
  declare invitation_expires_at: CreationOptional<Date | null>;
  declare invitation_accepted_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Guarantor.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    tenant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    guarantor_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM('guarantor', 'co_tenant', 'spouse'),
      allowNull: false,
      defaultValue: 'guarantor',
    },
    first_name: { type: DataTypes.STRING(100), allowNull: true },
    last_name: { type: DataTypes.STRING(100), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    folder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'folders', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    invitation_token: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    invitation_expires_at: { type: DataTypes.DATE, allowNull: true },
    invitation_accepted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'guarantors',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['guarantor_user_id'] },
      { fields: ['folder_id'] },
    ],
  }
);
