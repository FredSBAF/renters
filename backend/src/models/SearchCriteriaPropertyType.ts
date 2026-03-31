import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class SearchCriteriaPropertyType extends Model<
  InferAttributes<SearchCriteriaPropertyType>,
  InferCreationAttributes<SearchCriteriaPropertyType>
> {
  declare id: CreationOptional<number>;
  declare search_criteria_id: number;
  declare property_type:
    | 'studio'
    | 'T1'
    | 'T2'
    | 'T3'
    | 'T4'
    | 'T5+'
    | 'house'
    | 'colocation'
    | 'loft';
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SearchCriteriaPropertyType.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    search_criteria_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    property_type: {
      type: DataTypes.ENUM('studio', 'T1', 'T2', 'T3', 'T4', 'T5+', 'house', 'colocation', 'loft'),
      allowNull: false,
    },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'search_criteria_property_types',
    underscored: true,
    timestamps: true,
  }
);
