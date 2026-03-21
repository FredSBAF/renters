import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('notifications', {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: { type: DataTypes.STRING(100), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      action_url: { type: DataTypes.STRING(500), allowNull: true },
      is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      read_at: { type: DataTypes.DATE, allowNull: true },
      email_sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      email_sent_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('notifications', ['user_id', 'is_read']);
    await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
    await queryInterface.addIndex('notifications', ['type']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('notifications');
  },
};
