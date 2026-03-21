import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.changeColumn('users', 'status', {
      type: DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deleted', 'pending_deletion'),
      allowNull: false,
      defaultValue: 'pending_verification',
    });
    await queryInterface.addColumn('users', 'deletion_requested_at', { type: DataTypes.DATE, allowNull: true });
    await queryInterface.addColumn('users', 'deletion_cancellation_token', { type: DataTypes.STRING(255), allowNull: true, unique: true });
    await queryInterface.addColumn('users', 'deletion_cancellation_token_expires_at', { type: DataTypes.DATE, allowNull: true });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('users', 'deletion_requested_at');
    await queryInterface.removeColumn('users', 'deletion_cancellation_token');
    await queryInterface.removeColumn('users', 'deletion_cancellation_token_expires_at');
    await queryInterface.changeColumn('users', 'status', {
      type: DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deleted'),
      allowNull: false,
      defaultValue: 'pending_verification',
    });
  },
};
