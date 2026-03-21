import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('sharing_views', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      sharing_link_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: 'sharing_links', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      agency_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'agencies', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      viewer_email: { type: DataTypes.STRING(255), allowNull: true },
      viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
      documents_downloaded: { type: DataTypes.JSON, allowNull: true },
      access_level: {
        type: DataTypes.ENUM('limited', 'full'),
        allowNull: false,
        defaultValue: 'limited',
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('sharing_views', ['sharing_link_id']);
    await queryInterface.addIndex('sharing_views', ['agency_id']);
    await queryInterface.addIndex('sharing_views', ['viewed_at']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('sharing_views');
  },
};
