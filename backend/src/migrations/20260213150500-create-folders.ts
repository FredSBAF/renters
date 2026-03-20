import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('folders', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      status: {
        type: DataTypes.ENUM('incomplete', 'complete', 'verifying', 'verified', 'attention'),
        allowNull: false,
        defaultValue: 'incomplete',
      },
      completion_percentage: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      folder_status: {
        type: DataTypes.ENUM('active', 'standby', 'archived'),
        allowNull: false,
        defaultValue: 'active',
      },
      ai_score_global: { type: DataTypes.INTEGER, allowNull: true },
      ai_score_identity: { type: DataTypes.INTEGER, allowNull: true },
      ai_score_income: { type: DataTypes.INTEGER, allowNull: true },
      ai_score_stability: { type: DataTypes.INTEGER, allowNull: true },
      ai_score_coherence: { type: DataTypes.INTEGER, allowNull: true },
      ai_status: {
        type: DataTypes.ENUM('pending', 'analyzed', 'manual_review', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      ai_analyzed_at: { type: DataTypes.DATE, allowNull: true },
      ai_warnings: { type: DataTypes.JSON, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: true },
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
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    await queryInterface.addIndex('folders', ['user_id']);
    await queryInterface.addIndex('folders', ['status']);
    await queryInterface.addIndex('folders', ['folder_status']);
    await queryInterface.addIndex('folders', ['expires_at']);
    await queryInterface.addIndex('folders', ['deleted_at']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('folders');
  },
};
