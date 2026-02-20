'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agencies', {
      id: {
        type: Sequelize.DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: false,
      },
      siret: {
        type: Sequelize.DataTypes.CHAR(14),
        allowNull: false,
        unique: true,
      },
      legal_name: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: true,
      },
      address: {
        type: Sequelize.DataTypes.STRING(512),
        allowNull: true,
      },
      phone: {
        type: Sequelize.DataTypes.STRING(32),
        allowNull: true,
      },
      status: {
        type: Sequelize.DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
        allowNull: false,
        defaultValue: 'trial',
      },
      trial_ends_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
      },
      subscription_id: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: true,
      },
      customer_id: {
        type: Sequelize.DataTypes.STRING(255),
        allowNull: true,
      },
      next_billing_date: {
        type: Sequelize.DataTypes.DATEONLY,
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
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agencies');
  },
};
