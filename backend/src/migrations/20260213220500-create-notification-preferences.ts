import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('notification_preferences', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      inapp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_document_expiring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_document_expired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_folder_complete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_folder_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_folder_viewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      email_folder_document_downloaded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      email_new_folder_shared: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_subscription_alerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      weekly_digest_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      weekly_digest_day: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('notification_preferences', ['user_id'], { unique: true });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('notification_preferences');
  },
};
