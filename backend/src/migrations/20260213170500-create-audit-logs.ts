import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('audit_logs', {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      agency_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'agencies', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      entity_type: { type: DataTypes.STRING(50), allowNull: true },
      entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      details: { type: DataTypes.JSON, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['agency_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('audit_logs');
  },
};
