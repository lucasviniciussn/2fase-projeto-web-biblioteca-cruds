const Sequelize = require('sequelize');
const database = require('../config/database');

const livro = database.define('livro', {
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
    categoria: Sequelize.STRING,
    tags: Sequelize.STRING, 
    quantidade_total: Sequelize.INTEGER
});

module.exports = livro;