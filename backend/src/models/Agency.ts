import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Agency extends Model<
  InferAttributes<Agency>,
  InferCreationAttributes<Agency>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare siret: string;
  declare legal_name: CreationOptional<string | null>;
  declare address: CreationOptional<string | null>;
  declare phone: CreationOptional<string | null>;
  declare status: CreationOptional<'trial' | 'active' | 'suspended' | 'cancelled'>;
  declare trial_ends_at: CreationOptional<Date | null>;
  declare subscription_id: CreationOptional<string | null>;
  declare customer_id: CreationOptional<string | null>;
  declare next_billing_date: CreationOptional<string | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Agency.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    siret: { type: DataTypes.CHAR(14), allowNull: false, unique: true },
    legal_name: { type: DataTypes.STRING(255), allowNull: true },
    address: { type: DataTypes.STRING(512), allowNull: true },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    status: {
      type: DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
      allowNull: false,
      defaultValue: 'trial',
    },
    trial_ends_at: { type: DataTypes.DATE, allowNull: true },
    subscription_id: { type: DataTypes.STRING(255), allowNull: true },
    customer_id: { type: DataTypes.STRING(255), allowNull: true },
    next_billing_date: { type: DataTypes.DATEONLY, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'agencies', underscored: true, timestamps: true }
);
