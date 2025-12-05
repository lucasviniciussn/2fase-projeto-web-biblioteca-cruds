const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const app = express();
const db = require('./config/database');

// =============== MODELOS ================
const Livro = require('./models/livro.models');
const Usuario = require('./models/usuario.models');
const Biblioteca = require('./models/biblioteca.models');
const Acervo = require('./models/acervo.models');

const PORT = 3000;

// ===============================
// CONFIGURAÇÃO EXPRESS/HANDLEBARS
// ===============================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.engine('handlebars', exphbs.engine({
    defaultLayout: false,
    helpers: {
        json: (context) => JSON.stringify(context),
        eq: (a, b) => a === b
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
    }
}));
app.set('view engine', 'handlebars');


Acervo.belongsTo(Livro); 
Acervo.belongsTo(Biblioteca);
Acervo.belongsTo(Usuario); // Se null está disponível, se não estará emprestado.

const mapNivel = { 1: 'Leitor/Cliente', 2: 'Funcionário', 3: 'Bibliotecário' };

// ================== ROTAS DE VISUALIZAÇÃO (GET) ==================

app.get('/', (req, res) => {
    res.render('home');
});

// --- LIVROS ---
app.get('/livros', async (req, res) => {
    const livros = await Livro.findAll();
    const bibliotecas = await Biblioteca.findAll();
    
    const livrosView = livros.map(l => {
        const data = l.get({ plain: true });
        return data; 
    });

    res.render('livros', { livros: livrosView, bibliotecas });
});

app.get('/livros/:id', async (req, res) => {
    const livro = await Livro.findByPk(req.params.id);
    const bibliotecas = await Biblioteca.findAll();
    if (livro) {
        res.render('livro_detalhe', { livro: livro.toJSON(), bibliotecas: bibliotecas.map(b => b.toJSON()) });
    } else {
        res.redirect('/livros');
    }
});

// --- BIBLIOTECAS ---
app.get('/bibliotecas', async (req, res) => {
    const bibliotecas = await Biblioteca.findAll();
    res.render('bibliotecas', { bibliotecas: bibliotecas.map(b => b.toJSON()) });
});

app.get('/bibliotecas/:id', async (req, res) => {
    const biblioteca = await Biblioteca.findByPk(req.params.id);
    if (biblioteca) res.render('biblioteca_detalhe', { biblioteca: biblioteca.toJSON() });
    else res.redirect('/bibliotecas');
});

// --- USUÁRIOS ---
app.get('/usuarios', async (req, res) => {
    const usuarios = await Usuario.findAll();
    const niveisArr = Object.entries(mapNivel).map(([k, v]) => ({ id: k, nome: v }));
    
    const usuariosView = usuarios.map(u => {
        const userJson = u.toJSON();
        return { ...userJson, nivelLabel: mapNivel[userJson.nivel] };
    });

    res.render('usuarios', { usuarios: usuariosView, niveis: niveisArr });
});

app.get('/usuarios/:id', async (req, res) => {
    const usuario = await Usuario.findByPk(req.params.id);
    const niveisArr = Object.entries(mapNivel).map(([k, v]) => ({ id: parseInt(k), nome: v }));
    
    if (usuario) res.render('usuario_detalhe', { usuario: usuario.toJSON(), niveis: niveisArr });
    else res.redirect('/usuarios');
});

// --- ACERVO ---
app.get('/acervo', async (req, res) => {
    const acervo = await Acervo.findAll({ include: [Livro, Biblioteca, Usuario] });
    
    const livros = await Livro.findAll();
    const bibliotecas = await Biblioteca.findAll();

    const acervoView = acervo.map(item => {
        const i = item.toJSON();
        return {
            ...i,
            nomeLivro: i.livro ? i.livro.nome : 'Desconhecido',
            cnpjBiblioteca: i.biblioteca ? i.biblioteca.cnpj : 'Desconhecido',
            status: i.usuarioId ? `Emprestado (User ${i.usuarioId})` : 'Disponível'
        };
    });

    res.render('acervo', { 
        acervo: acervoView,
        livros: livros.map(l => l.toJSON()),
        bibliotecas: bibliotecas.map(b => b.toJSON())
    });
});

// --- ACERVO (DETALHE/EDIÇÃO) ---
app.get('/acervo/:id', async (req, res) => {
    try {
        const item = await Acervo.findByPk(req.params.id, { 
            include: [Livro, Biblioteca, Usuario] 
        });

        const livros = await Livro.findAll();
        const bibliotecas = await Biblioteca.findAll();

        if (item) {
            const i = item.toJSON();
            const itemName = i.livro ? i.livro.nome : 'Item #' + i.id;
            
            res.render('acervo_detalhe', { 
                item: i, 
                itemName,
                livros: livros.map(l => l.toJSON()),
                bibliotecas: bibliotecas.map(b => b.toJSON())
            });
        } else {
            res.redirect('/acervo');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao buscar detalhes");
    }
});

// ================== ROTAS DE API (CRUD LOGIC) ==================

// POST /livros/new
app.post('/livros/new', async (req, res) => {
    try {
        const { nome, categoria, tags, quantidade_total, idbiblioteca } = req.body;

        const tagsString = Array.isArray(tags) ? tags.join(',') : tags;
        const qtdTotal = parseInt(quantidade_total);

        const novoLivro = await Livro.create({
            nome,
            categoria,
            tags: tagsString,
            quantidade_total: qtdTotal
        });

        const copias = [];
        for (let i = 0; i < qtdTotal; i++) {
            copias.push({
                livroId: novoLivro.id,
                bibliotecaId: parseInt(idbiblioteca),
                usuarioId: null
            });
        }
        await Acervo.bulkCreate(copias);

        res.status(201).json(novoLivro);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao salvar livro' });
    }
});

// PUT /livros/:id
app.put('/livros/:id', async (req, res) => {
    try {
        const livro = await Livro.findByPk(req.params.id);
        if (!livro) return res.status(404).json({ error: 'Livro não encontrado' });

        const { nome, categoria, tags, quantidade_total, idbiblioteca } = req.body;
        const oldQuantidade = livro.quantidade_total;

        if (nome) livro.nome = nome;
        if (categoria) livro.categoria = categoria;
        if (tags) livro.tags = Array.isArray(tags) ? tags.join(',') : tags;

        if (quantidade_total !== undefined) {
            const newQuantidade = parseInt(quantidade_total);
            const diff = newQuantidade - oldQuantidade;
            livro.quantidade_total = newQuantidade;

            if (diff > 0) {
                const libId = idbiblioteca ? parseInt(idbiblioteca) : 1; 
                const novasCopias = [];
                for (let i = 0; i < diff; i++) {
                    novasCopias.push({ livroId: livro.id, bibliotecaId: libId, usuarioId: null });
                }
                await Acervo.bulkCreate(novasCopias);
            } else if (diff < 0) {
                const remover = Math.abs(diff);
                const copiasDisponiveis = await Acervo.findAll({
                    where: { livroId: livro.id, usuarioId: null },
                    limit: remover
                });

                if (copiasDisponiveis.length < remover) {
                    return res.status(400).json({ error: 'Não há cópias disponíveis suficientes para remover.' });
                }
                
                const idsParaRemover = copiasDisponiveis.map(c => c.id);
                await Acervo.destroy({ where: { id: idsParaRemover } });
            }
        }
        
        await livro.save();
        res.json(livro);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// DELETE /livros/:id
app.delete('/livros/:id', async (req, res) => {
    try {
        const livro = await Livro.findByPk(req.params.id);
        if (!livro) return res.status(404).json({ error: 'Não encontrado!' });

        // Deleta o livro E as cópias do acervo (Cascata manual ou via config do banco)
        await Acervo.destroy({ where: { livroId: livro.id } });
        await livro.destroy();
        
        res.json({ mensagem: 'Deletado', livro });
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// POST /usuarios
app.post('/usuarios', async (req, res) => {
    try {
        const { nome, cpf, idade, nivel } = req.body;
        const novoUsuario = await Usuario.create({ nome, cpf, idade, nivel });
        res.status(201).json(novoUsuario);
    } catch (e) {
        res.status(400).json({ error: 'Erro ao criar usuário' });
    }
});

// PUT /usuarios/:id
app.put('/usuarios/:id', async (req, res) => {
    try {
        await Usuario.update(req.body, { where: { id: req.params.id } });
        const atualizado = await Usuario.findByPk(req.params.id);
        res.json(atualizado);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// DELETE /usuarios/:id
app.delete('/usuarios/:id', async (req, res) => {
    try {
        const result = await Usuario.destroy({ where: { id: req.params.id } });
        if(result) res.json({mensagem: 'Deletado'});
        else res.status(404).json({error: 'Não encontrado'});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// POST /bibliotecas
app.post('/bibliotecas', async (req, res) => {
    try {
        const { cnpj, acervo, cep } = req.body;
        const novaBib = await Biblioteca.create({ cnpj, acervo_total: acervo, cep });
        res.status(201).json(novaBib);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// PUT /bibliotecas/:id
app.put('/bibliotecas/:id', async (req, res) => {
    try {
        await Biblioteca.update(req.body, { where: { id: req.params.id } });
        const b = await Biblioteca.findByPk(req.params.id);
        res.json(b);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// DELETE /bibliotecas/:id
app.delete('/bibliotecas/:id', async (req, res) => {
    try {
        const r = await Biblioteca.destroy({ where: { id: req.params.id } });
        if(r) res.json({mensagem: 'Deletada'});
        else res.status(404).json({error: 'Não encontrada'});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// POST /acervo
app.post('/acervo', async (req, res) => {
    try {
        const { livroId, bibliotecaId, quantidade } = req.body;
        
        const qtd = parseInt(quantidade) || 1;
        const livId = parseInt(livroId);
        const bibId = parseInt(bibliotecaId);

        const novasCopias = [];
        for (let i = 0; i < qtd; i++) {
            novasCopias.push({
                livroId: livId,
                bibliotecaId: bibId,
                usuarioId: null
            });
        }
        
        await Acervo.bulkCreate(novasCopias);

        const livro = await Livro.findByPk(livId);
        if(livro) {
            livro.quantidade_total += qtd;
            await livro.save();
        }

        res.status(201).json({ message: 'Cópias criadas com sucesso' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// PUT /acervo/:id
app.put('/acervo/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { livroId, bibliotecaId, idUsuario } = req.body;
        
        const copia = await Acervo.findByPk(id);
        if(!copia) return res.status(404).json({error: 'Não encontrado'});

        if (livroId && parseInt(livroId) !== copia.livroId) {
            const livroAntigo = await Livro.findByPk(copia.livroId);
            const livroNovo = await Livro.findByPk(livroId);
            
            if(livroAntigo) { livroAntigo.quantidade_total -= 1; await livroAntigo.save(); }
            if(livroNovo) { livroNovo.quantidade_total += 1; await livroNovo.save(); }
            
            copia.livroId = parseInt(livroId);
        }

        if (bibliotecaId) copia.bibliotecaId = parseInt(bibliotecaId);
        
        if (idUsuario !== undefined) {
            const uId = parseInt(idUsuario);
            if (uId <= 0 || isNaN(uId)) {
                copia.usuarioId = null;
            } else {
                const userExists = await Usuario.findByPk(uId);
                if (!userExists) return res.status(404).json({error: 'Usuário não existe'});
                copia.usuarioId = uId;
            }
        }

        await copia.save();
        res.json(copia);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /acervo/:id
app.delete('/acervo/:id', async (req, res) => {
    try {
        const copia = await Acervo.findByPk(req.params.id);
        if(!copia) return res.status(404).json({error: 'Não encontrado'});

        const livroId = copia.livroId;
        
        await copia.destroy();

        const livro = await Livro.findByPk(livroId);
        if(livro && livro.quantidade_total > 0) {
            livro.quantidade_total -= 1;
            await livro.save();
        }

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// INICIALIZAÇÃO DO BANCO E SERVIDOR
db.sync({ force: false }).then(() => {
    console.log('Banco de dados sincronizado!');
    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
});