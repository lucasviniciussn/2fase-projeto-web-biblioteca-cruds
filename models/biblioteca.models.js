const Sequelize = require('sequelize');
const database = require('../config/database');

const biblioteca = database.define('biblioteca', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    cnpj: Sequelize.STRING,
    acervo_total: Sequelize.INTEGER,
    cep: Sequelize.STRING
});

module.exports = biblioteca;