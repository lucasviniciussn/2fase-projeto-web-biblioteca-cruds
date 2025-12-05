const Sequelize = require('sequelize');
const database = require('../config/database');
const livro = require('./livro.models');
const biblioteca = require('./biblioteca.models');
const usuario = require('./usuario.models');

const acervo = database.define('acervo', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
});

module.exports = acervo;