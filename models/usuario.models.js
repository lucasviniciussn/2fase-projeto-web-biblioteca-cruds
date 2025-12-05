const Sequelize = require('sequelize');
const database = require('../config/database');

const usuario = database.define('usuario', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    nome: {
        type: Sequelize.STRING,
        allowNull: false
    },
    cpf: Sequelize.STRING,
    idade: Sequelize.INTEGER,
    nivel: Sequelize.INTEGER 
});

module.exports = usuario;