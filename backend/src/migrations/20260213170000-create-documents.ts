import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('documents', {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      folder_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'folders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      document_type: { type: DataTypes.STRING(50), allowNull: false },
      file_path: { type: DataTypes.STRING(500), allowNull: false },
      file_name: { type: DataTypes.STRING(255), allowNull: false },
      file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      mime_type: { type: DataTypes.STRING(100), allowNull: false },
      extracted_text: { type: DataTypes.TEXT, allowNull: true },
      extracted_data: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending_analysis', 'valid', 'invalid', 'expired', 'attention'),
        allowNull: false,
        defaultValue: 'pending_analysis',
      },
      issued_at: { type: DataTypes.DATEONLY, allowNull: true },
      expires_at: { type: DataTypes.DATEONLY, allowNull: true },
      ai_score: { type: DataTypes.INTEGER, allowNull: true },
      ai_warnings: { type: DataTypes.JSON, allowNull: true },
      ai_metadata: { type: DataTypes.JSON, allowNull: true },
      comment: { type: DataTypes.TEXT, allowNull: true },
      expiry_notified_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('documents', ['folder_id']);
    await queryInterface.addIndex('documents', ['document_type']);
    await queryInterface.addIndex('documents', ['status']);
    await queryInterface.addIndex('documents', ['expires_at']);
    await queryInterface.addIndex('documents', ['deleted_at']);
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('documents');
  },
};
