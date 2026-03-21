import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('folders', 'folder_expiry_notified_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('folders', 'folder_expiry_notified_at');
  },
};
