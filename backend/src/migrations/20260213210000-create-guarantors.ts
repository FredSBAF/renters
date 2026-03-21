import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('guarantors', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      guarantor_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      role: {
        type: DataTypes.ENUM('guarantor', 'co_tenant', 'spouse'),
        allowNull: false,
        defaultValue: 'guarantor',
      },
      first_name: { type: DataTypes.STRING(100), allowNull: true },
      last_name: { type: DataTypes.STRING(100), allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      folder_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'folders', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      invitation_token: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      invitation_expires_at: { type: DataTypes.DATE, allowNull: true },
      invitation_accepted_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('guarantors', ['tenant_id']);
    await queryInterface.addIndex('guarantors', ['guarantor_user_id']);
    await queryInterface.addIndex('guarantors', ['folder_id']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('guarantors');
  },
};
