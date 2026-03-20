import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('user_consents', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      consent_type: {
        type: DataTypes.ENUM('data_storage', 'data_sharing', 'ml_training'),
        allowNull: false,
      },
      consented_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      ip_address: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('user_consents', ['user_id']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('user_consents');
  },
};
