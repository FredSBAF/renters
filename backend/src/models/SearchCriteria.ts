import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { SearchCriteriaCity } from './SearchCriteriaCity';
import { SearchCriteriaPropertyType } from './SearchCriteriaPropertyType';

export class SearchCriteria extends Model<
  InferAttributes<SearchCriteria>,
  InferCreationAttributes<SearchCriteria>
> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare budget_ideal: number;
  declare budget_max: number;
  declare availability_type: 'immediate' | 'date';
  declare availability_date: CreationOptional<string | null>;
  declare presentation_text: CreationOptional<string | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  declare cities?: NonAttribute<SearchCriteriaCity[]>;
  declare propertyTypes?: NonAttribute<SearchCriteriaPropertyType[]>;

  toJSON(): object {
    return {
      id: this.id,
      user_id: this.user_id,
      cities:
        this.cities?.map((c) => ({
          id: c.id,
          name: c.name,
          place_id: c.place_id,
          lat: Number(c.lat),
          lng: Number(c.lng),
          radius_km: c.radius_km,
        })) ?? [],
      property_types: this.propertyTypes?.map((pt) => pt.property_type) ?? [],
      budget_ideal: this.budget_ideal,
      budget_max: this.budget_max,
      availability_type: this.availability_type,
      availability_date: this.availability_date,
      presentation_text: this.presentation_text,
      updated_at: this.updated_at,
    };
  }
}

SearchCriteria.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    budget_ideal: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    budget_max: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    availability_type: {
      type: DataTypes.ENUM('immediate', 'date'),
      allowNull: false,
      defaultValue: 'immediate',
    },
    availability_date: { type: DataTypes.DATEONLY, allowNull: true },
    presentation_text: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'search_criteria',
    underscored: true,
    timestamps: true,
  }
);
