import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('sharing_links', {
      id: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
      folder_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'folders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      context: { type: DataTypes.JSON, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      views_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      last_viewed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('sharing_links', ['folder_id']);
    await queryInterface.addIndex('sharing_links', ['expires_at']);
    await queryInterface.addIndex('sharing_links', ['revoked_at']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('sharing_links');
  },
};
