import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('search_criteria', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      budget_ideal: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      budget_max: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      availability_type: {
        type: DataTypes.ENUM('immediate', 'date'),
        allowNull: false,
        defaultValue: 'immediate',
      },
      availability_date: { type: DataTypes.DATEONLY, allowNull: true },
      presentation_text: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('search_criteria', ['user_id'], { name: 'idx_sc_user' });

    await queryInterface.createTable('search_criteria_cities', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      search_criteria_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'search_criteria', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      place_id: { type: DataTypes.STRING(255), allowNull: false },
      lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      radius_km: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 5 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('search_criteria_cities', ['search_criteria_id'], {
      name: 'idx_scc_criteria',
    });

    await queryInterface.createTable('search_criteria_property_types', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      search_criteria_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'search_criteria', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      property_type: {
        type: DataTypes.ENUM('studio', 'T1', 'T2', 'T3', 'T4', 'T5+', 'house', 'colocation', 'loft'),
        allowNull: false,
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addConstraint('search_criteria_property_types', {
      type: 'unique',
      fields: ['search_criteria_id', 'property_type'],
      name: 'unique_type_per_criteria',
    });
    await queryInterface.addIndex('search_criteria_property_types', ['search_criteria_id'], {
      name: 'idx_scpt_criteria',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('search_criteria_property_types');
    await queryInterface.dropTable('search_criteria_cities');
    await queryInterface.dropTable('search_criteria');
  },
};
