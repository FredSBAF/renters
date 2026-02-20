'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.test') });
}

const env = process.env.NODE_ENV || 'development';

module.exports = {
  [env]: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pouraccord_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    dialectOptions: {
      charset: 'utf8mb4',
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      underscored: true,
      timestamps: true,
    },
  },
};
