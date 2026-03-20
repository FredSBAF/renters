import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('payment_logs', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      agency_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      stripe_event_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      event_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'eur',
      },
      status: {
        type: DataTypes.ENUM('success', 'failed', 'pending'),
        allowNull: false,
      },
      stripe_payload: {
        type: DataTypes.JSON,
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

    await queryInterface.addIndex('payment_logs', ['agency_id']);
    await queryInterface.addIndex('payment_logs', ['stripe_event_id'], { unique: true });
    await queryInterface.addIndex('payment_logs', ['event_type']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('payment_logs');
  },
};
