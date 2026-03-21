import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('moderation_queue', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      folder_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'folders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_review', 'validated', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      assigned_to: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ai_score_at_submission: { type: DataTypes.INTEGER, allowNull: false },
      motifs: { type: DataTypes.JSON, allowNull: false },
      admin_notes: { type: DataTypes.TEXT, allowNull: true },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      resolved_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      resolution: {
        type: DataTypes.ENUM('approved', 'rejected', 'fraud_confirmed'),
        allowNull: true,
      },
      adjusted_score: { type: DataTypes.INTEGER, allowNull: true },
      sla_deadline: { type: DataTypes.DATE, allowNull: false },
      sla_breached: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('moderation_queue', ['status']);
    await queryInterface.addIndex('moderation_queue', ['priority']);
    await queryInterface.addIndex('moderation_queue', ['sla_deadline']);
    await queryInterface.addIndex('moderation_queue', ['assigned_to']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('moderation_queue');
  },
};
