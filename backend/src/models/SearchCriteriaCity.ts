import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
} from 'sequelize';
import { sequelize } from '../config/database';

export class SearchCriteriaCity extends Model<
  InferAttributes<SearchCriteriaCity>,
  InferCreationAttributes<SearchCriteriaCity>
> {
  declare id: CreationOptional<number>;
  declare search_criteria_id: number;
  declare name: string;
  declare place_id: string;
  declare lat: number;
  declare lng: number;
  declare radius_km: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SearchCriteriaCity.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    search_criteria_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    place_id: { type: DataTypes.STRING(255), allowNull: false },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    radius_km: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 5 },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'search_criteria_cities',
    underscored: true,
    timestamps: true,
  }
);
