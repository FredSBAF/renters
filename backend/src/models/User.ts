import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Agency } from './Agency';

export type UserRole = 'tenant' | 'agency_owner' | 'agency_agent' | 'admin';
export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'deleted' | 'pending_deletion';
export type TenantProfile =
  | 'employee_cdi'
  | 'employee_cdd'
  | 'student'
  | 'freelance'
  | 'retired'
  | 'other';

export interface UserAttributes {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  tenant_profile: TenantProfile | null;
  address: {
    label: string;
    house_number?: string;
    street?: string;
    postcode?: string;
    city: string;
    citycode?: string;
    context?: string;
    country: string;
    latitude?: number;
    longitude?: number;
    source: 'api-adresse' | 'manual';
  } | null;
  is_2fa_enabled: boolean;
  created_at: Date;
  updated_at: Date;
  ai_generation_count: number;
  ai_generation_reset_at: Date | null;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare password_hash: string;
  declare role: UserRole;
  declare status: CreationOptional<UserStatus>;
  declare first_name: CreationOptional<string | null>;
  declare last_name: CreationOptional<string | null>;
  declare phone: CreationOptional<string | null>;
  declare date_of_birth: CreationOptional<string | null>;
  declare tenant_profile: CreationOptional<TenantProfile | null>;
  declare address: CreationOptional<object | null>;
  declare totp_secret: CreationOptional<string | null>;
  declare is_2fa_enabled: CreationOptional<boolean>;
  declare agency_id: CreationOptional<number | null>;
  declare email_verified_at: CreationOptional<Date | null>;
  declare last_login_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
  declare deletion_requested_at: CreationOptional<Date | null>;
  declare deletion_cancellation_token: CreationOptional<string | null>;
  declare deletion_cancellation_token_expires_at: CreationOptional<Date | null>;
  declare ai_generation_count: CreationOptional<number>;
  declare ai_generation_reset_at: CreationOptional<Date | null>;

  declare agency?: NonAttribute<Agency>;

  toPublicJSON(): Partial<UserAttributes> {
    const json = this.toJSON() as Record<string, unknown>;
    delete json.password_hash;
    delete json.totp_secret;
    delete json.createdAt;
    delete json.updatedAt;
    delete json.deletedAt;
    return json as Partial<UserAttributes>;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM('tenant', 'agency_owner', 'agency_agent', 'admin'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deleted', 'pending_deletion'),
      allowNull: false,
      defaultValue: 'pending_verification',
    },
    first_name: { type: DataTypes.STRING(100), allowNull: true },
    last_name: { type: DataTypes.STRING(100), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    tenant_profile: {
      type: DataTypes.ENUM(
        'employee_cdi',
        'employee_cdd',
        'student',
        'freelance',
        'retired',
        'other'
      ),
      allowNull: true,
    },
    address: { type: DataTypes.JSON, allowNull: true },
    totp_secret: { type: DataTypes.STRING(512), allowNull: true },
    is_2fa_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    agency_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    email_verified_at: { type: DataTypes.DATE, allowNull: true },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    deletion_requested_at: { type: DataTypes.DATE, allowNull: true },
    deletion_cancellation_token: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    deletion_cancellation_token_expires_at: { type: DataTypes.DATE, allowNull: true },
    ai_generation_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    ai_generation_reset_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    paranoid: true,
    timestamps: true,
    hooks: {
      beforeUpdate: (user) => {
        user.updated_at = new Date();
      },
    },
  }
);
