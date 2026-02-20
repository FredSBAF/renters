'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.DataTypes.ENUM('tenant', 'agency_owner', 'agency_agent', 'admin'),
        allowNull: false,
      },
      status: {
        type: Sequelize.DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deleted'),
        allowNull: false,
        defaultValue: 'pending_verification',
      },
      tenant_profile: {
        type: Sequelize.DataTypes.ENUM('employee_cdi', 'employee_cdd', 'student', 'freelance', 'retired', 'other'),
        allowNull: true,
      },
      totp_secret: {
        type: Sequelize.DataTypes.STRING(512),
        allowNull: true,
      },
      is_2fa_enabled: {
        type: Sequelize.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      agency_id: {
        type: Sequelize.DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'agencies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email_verified_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });

    await queryInterface.addIndex('users', ['agency_id']);
    await queryInterface.addIndex('users', ['deleted_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
