import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class DocumentType extends Model<
  InferAttributes<DocumentType>,
  InferCreationAttributes<DocumentType>
> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare label_fr: string;
  declare label_en: string;
  declare validity_months: CreationOptional<number | null>;
  declare is_required: CreationOptional<boolean>;
  declare required_for_profiles: CreationOptional<string[]>;
  declare sort_order: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

DocumentType.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label_fr: { type: DataTypes.STRING(255), allowNull: false },
    label_en: { type: DataTypes.STRING(255), allowNull: false },
    validity_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    required_for_profiles: { type: DataTypes.JSON, allowNull: false, defaultValue: ['all'] },
    sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'document_types',
    underscored: true,
    indexes: [{ unique: true, fields: ['code'] }],
  }
);
