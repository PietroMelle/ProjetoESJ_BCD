// ========================================
// IMPORTAÇÕES DAS BIBLIOTECAS NECESSÁRIAS
// ========================================
const express = require('express');           
const { Client } = require('pg');             // Driver para conectar ao PostgreSQL
const session = require('express-session');   // Middleware para gerenciar sessões de usuários

const app = express();
const PORT = 3000;

// ========================================
// 1. CONFIGURAÇÃO DO BANCO DE DADOS (POSTGRESQL)
// ========================================
const client = new Client({
    user: 'postgres',              
    host: 'localhost',             
    database: 'tableProjeto1ESJ',  
    password: 'senai',             
    port: 5432,                    
});

// Conecta ao banco de dados e exibe mensagem de sucesso ou erro
client.connect()
    .then(() => console.log('Conectado ao PostgreSQL com sucesso!'))
    .catch(err => console.error('Erro de conexão com o DB', err.stack));

// ========================================
// 2. CONFIGURAÇÃO E MIDDLEWARES
// ========================================

// Define EJS como engine de templates (para renderizar .ejs)
app.set('view engine', 'ejs');

// Define a pasta onde os arquivos .ejs estão localizados
app.set('views', 'views');

// Permite servir arquivos estáticos (CSS, JS, imagens) da pasta 'public'
app.use(express.static('public'));

// Middleware que transforma dados de formulários em objetos JavaScript
app.use(express.urlencoded({ extended: true }));

// ========================================
// CONFIGURAÇÃO DE SESSÃO
// ========================================
// Cria e gerencia sessões dos usuários logados
app.use(session({
    secret: 'chave_secreta_para_assinatura',  // Chave para criptografar as sessões
    resave: false,                             
    saveUninitialized: false,                  
    cookie: { maxAge: 3600000 }                // Sessão expira em 1 hora
}));

// ========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ========================================
// Função que verifica se o usuário está logado
// Se estiver, permite acessar a página; se não, redireciona para o login
function requireLogin(req, res, next) {
    if (req.session.userId) {  
        next();                
    } else {
        res.redirect('/login'); 
    }
}

// ========================================
// 3. ROTAS DE AUTENTICAÇÃO
// ========================================

// Rota raiz: redireciona para a página de login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Rota GET /login: exibe a página de login
app.get('/login', (req, res) => {
    // Renderiza o arquivo login.ejs com mensagens de erro (se houver)
    res.render('login', { error: req.session.error, message: null });
    req.session.error = null;
});

// Rota POST /login: processa o login do usuário
app.post('/login', async (req, res) => {
    const { login, senha } = req.body; // Obtém login e senha do formulário
    
    try {
        // Consulta o banco de dados procurando um usuário com login e senha corretos
        const query = 'SELECT id, nome FROM usuarios WHERE login = $1 AND senha = $2';
        const result = await client.query(query, [login, senha]);

        // Se encontrou o usuário (1 resultado)
        if (result.rows.length === 1) {
            req.session.userId = result.rows[0].id;     // Armazena ID na sessão
            req.session.userName = result.rows[0].nome; // Armazena nome na sessão
            res.redirect('/menu');                       // Redireciona para o menu
        } else {
            // Se login/senha estiverem incorretos
            req.session.error = 'Login ou Senha inválidos.';
            res.redirect('/login'); // Volta para login com mensagem de erro
        }
    } catch (err) {
        console.error(err);
        req.session.error = 'Ocorreu um erro ao tentar fazer login.';
        res.redirect('/login');
    }
});

// Rota POST /logout: faz logout do usuário
app.post('/logout', (req, res) => {
    // Destroy a sessão do usuário (Destruir literalmente, apaga tudo e volta ao login)
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/menu'); // Se erro, volta para menu
        }
        res.redirect('/login'); // Redireciona para login
    });
});

// ========================================
// 4. ROTA DO MENU PRINCIPAL
// ========================================
// Exibe o menu principal (requer autenticação)
app.get('/menu', requireLogin, (req, res) => {
    // Renderiza menu.ejs com o nome do usuário logado
    res.render('menu', { userName: req.session.userName });
});

// ========================================
// 5. CRUD DE PRODUTOS
// ========================================
// CRUD = Create, Read, Update, Delete (Criar, Ler, Atualizar, Deletar)

// -------- READ (Listar) --------
// Rota GET /produtos: lista todos os produtos
app.get('/produtos', requireLogin, async (req, res) => {
    try {
        // Consulta que junta dados de produto, categoria e saldos
        const result = await client.query(`
            SELECT p.idproduto, p.nome, p.codigo_interno, p.idcategoria, 
                   p.fabricante, p.preco_venda, p.estoque_minimo, 
                   p.voltagem, p.cor, p.peso, p.material, p.descricao,
                   c.nome as categoria_nome,
                   s.saldo as estoque_atual
            FROM produto p
            LEFT JOIN categoria c ON p.idcategoria = c.idcategoria
            LEFT JOIN saldos s ON p.idproduto = s.idproduto
            ORDER BY p.idproduto
        `);
        
        // Busca todas as categorias para o dropdown
        const categorias = await client.query('SELECT idcategoria, nome FROM categoria ORDER BY nome');
        
        // Renderiza a página de produtos com os dados
        res.render('produtos', { 
            produtos: result.rows, 
            categorias: categorias.rows,
            error: req.session.produtoError || null 
        });
        req.session.produtoError = null; // Limpa mensagem de erro
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao listar produtos.');
    }
});

// -------- CREATE (Criar) --------
// Rota POST /produtos: cadastra um novo produto
app.post('/produtos', requireLogin, async (req, res) => {
    // Extrai dados do formulário
    const { nome, codigo_interno, idcategoria, fabricante, preco_venda, 
            estoque_minimo, voltagem, cor, peso, material, descricao } = req.body;
    
    // Validação: nome e código são obrigatórios
    if (!nome || !codigo_interno) {
        req.session.produtoError = 'Nome e código interno são obrigatórios.';
        return res.redirect('/produtos'); // Se der erro, não funciona e volta 
    }
    
    // Inicia uma transação (operação atômica no banco)
    await client.query('BEGIN');
    try {
        // Insere o novo produto na tabela
        await client.query(
            `INSERT INTO produto (nome, codigo_interno, idcategoria, fabricante, preco_venda, 
                                 estoque_minimo, voltagem, cor, peso, material, descricao) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, // Cada coluna tem um valor (1, 2, 3...)
            [nome, codigo_interno, idcategoria || null, fabricante || null, preco_venda || 0, 
             estoque_minimo || 0, voltagem || null, cor || null, peso || null, 
             material || null, descricao || null] // Valores do formulário (ou null/0 se vazio)
        );
        
        // Confirma a transação (salva todas as mudanças)
        await client.query('COMMIT');
        res.redirect('/produtos'); // Volta para lista de produtos
    } catch (err) {
        // Se houver erro, desfaz todas as mudanças
        await client.query('ROLLBACK');
        console.error(err);
        
        // Verifica tipo de erro
        if (err.code === '23505') { // Erro de código duplicado
            req.session.produtoError = 'Código interno já existe!';
        } else {
            req.session.produtoError = 'Erro ao cadastrar produto.';
        }
        res.redirect('/produtos');
    }
});

// -------- UPDATE (Editar) - Exibir formulário --------
// Rota GET /produtos/editar/:idp: exibe o formulário de edição
app.get('/produtos/editar/:idp', requireLogin, async (req, res) => {
    const { idp } = req.params; // Pega o ID do produto da URL
    
    try {
        // Busca os dados do produto | * = tudo da tabela produto + saldo
        const result = await client.query(
            `SELECT p.*, s.saldo  
             FROM produto p
             LEFT JOIN saldos s ON p.idproduto = s.idproduto
             WHERE p.idproduto = $1`, 
            [idp]
        );
        
        // Busca as categorias para o dropdown
        const categorias = await client.query(
            'SELECT idcategoria, nome FROM categoria ORDER BY nome'
        );
        
        // Verifica se o produto existe
        if (result.rows.length === 0) return res.status(404).send('Produto não encontrado.');
        
        // Renderiza o formulário de edição com os dados do produto
        res.render('editar_produtos', { 
            produto: result.rows[0], 
            categorias: categorias.rows 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar produto para edição.');
    }
});

// -------- UPDATE (Editar) - Processar --------
// Rota POST /produtos/atualizar/:idp: processa a edição do produto
app.post('/produtos/atualizar/:idp', requireLogin, async (req, res) => {
    const { idp } = req.params; // ID do produto
    
    // Extrai dados do formulário
    const { nome, codigo_interno, idcategoria, fabricante, preco_venda, 
            estoque_minimo, voltagem, cor, peso, material, descricao } = req.body;
    
    // Validação
    if (!nome || !codigo_interno) {
        req.session.produtoError = 'Nome e código interno são obrigatórios.';
        return res.redirect('/produtos');
    }
    
    try {
        // Atualiza o produto no banco de dados
        await client.query(
            `UPDATE produto SET nome = $1, codigo_interno = $2, idcategoria = $3, 
                              fabricante = $4, preco_venda = $5, estoque_minimo = $6, 
                              voltagem = $7, cor = $8, peso = $9, material = $10, 
                              descricao = $11 
             WHERE idproduto = $12`,
            [nome, codigo_interno, idcategoria || null, fabricante || null, 
             preco_venda || 0, estoque_minimo || 0, voltagem || null, cor || null, 
             peso || null, material || null, descricao || null, idp]
        );
        res.redirect('/produtos'); // Volta para lista
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            req.session.produtoError = 'Código interno já existe!';
        } else {
            req.session.produtoError = 'Erro ao atualizar produto.';
        }
        res.redirect('/produtos');
    }
});

// -------- DELETE (Excluir) --------
// Rota POST /produtos/excluir/:idp: deleta um produto
app.post('/produtos/excluir/:idp', requireLogin, async (req, res) => {
    const { idp } = req.params; // ID do produto
    
    try {
        // Deleta em cascata: primeiro movimentos, depois saldos, depois produto
        await client.query('DELETE FROM movimento_estoque WHERE idproduto = $1', [idp]);
        await client.query('DELETE FROM saldos WHERE idproduto = $1', [idp]);
        await client.query('DELETE FROM produto WHERE idproduto = $1', [idp]);
        res.redirect('/produtos'); // Volta para lista
    } catch (err) {
        console.error(err);
        req.session.produtoError = 'Erro ao excluir produto.';
        res.redirect('/produtos');
    }
});

// ========================================
// 6. MOVIMENTO DE ESTOQUE
// ========================================
// Controla entradas e saídas de produtos do estoque

// Exibe a página de movimento
app.get('/movimento', requireLogin, async (req, res) => {
    try {
        // Busca todos os produtos com seus saldos atuais
        const produtos = await client.query(`
            SELECT p.idproduto, p.nome, s.saldo
            FROM produto p
            LEFT JOIN saldos s ON p.idproduto = s.idproduto
            ORDER BY p.nome
        `);
        
        res.render('movimento', {
            produtos: produtos.rows,
            message: req.session.movimentoMessage || null,
            error: req.session.movimentoError || null
        });
        req.session.movimentoMessage = null; // Limpa mensagens
        req.session.movimentoError = null;
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar tela de movimento.');
    }
});

// Processa um movimento de entrada ou saída
app.post('/movimento', requireLogin, async (req, res) => {
    const { idproduto, tipo, quantidade } = req.body;
    const qtd = parseInt(quantidade); // Converte para número
    const tipoMovimento = tipo === 'E' ? 'E' : 'S'; // E = Entrada, S = Saída

    console.log('📥 POST /movimento recebido:', { idproduto, tipo, quantidade }); // LOG DE DEBUG

    // Validação dos dados
    if (!idproduto || isNaN(qtd) || qtd <= 0) {
        console.log('❌ Validação falhou:', { idproduto, qtd }); // LOG DE DEBUG
        req.session.movimentoError = 'Preencha todos os campos corretamente.';
        return res.redirect('/movimento');
    }

    // Inicia transação para garantir consistência dos dados
    await client.query('BEGIN');
    try {
        // Primeiro verifica se o produto existe (sem lock)
        const verificaResult = await client.query(
            `SELECT idproduto FROM produto WHERE idproduto = $1`, 
            [idproduto]
        );
        
        if (verificaResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.log('❌ Produto não encontrado:', idproduto); // LOG DE DEBUG
            req.session.movimentoError = 'Produto não encontrado.';
            return res.redirect('/movimento');
        }

        // Busca o saldo (sem lock no produto)
        const saldoResult = await client.query(
            `SELECT s.saldo FROM saldos s WHERE s.idproduto = $1`, 
            [idproduto]
        );
        
        const produtoResult = await client.query(
            `SELECT estoque_minimo FROM produto WHERE idproduto = $1`, 
            [idproduto]
        );
        
        // Verifica se o produto existe
        if (produtoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            req.session.movimentoError = 'Produto não encontrado.';
            return res.redirect('/movimento');
        }

        const produto = produtoResult.rows[0];
        const estoque_minimo = produto.estoque_minimo;
        const saldoAtual = saldoResult.rows.length > 0 ? saldoResult.rows[0].saldo || 0 : 0;
        let novoSaldo = saldoAtual;

        console.log('📊 Dados do movimento:', { idproduto, saldoAtual, estoque_minimo, tipo: tipoMovimento, qtd }); // LOG DE DEBUG

        // Se for SAÍDA de estoque
        if (tipoMovimento === 'S') {
            // Verifica se há quantidade suficiente
            if (qtd > saldoAtual) {
                await client.query('ROLLBACK');
                console.log('❌ Saldo insuficiente:', { qtd, saldoAtual }); // LOG DE DEBUG
                req.session.movimentoError = `Saldo insuficiente (${saldoAtual}) para saída de ${qtd}.`;
                return res.redirect('/movimento');
            }
            
            // Verifica se não vai ficar abaixo do mínimo
            if (saldoAtual - qtd < estoque_minimo) {
                await client.query('ROLLBACK');
                console.log('❌ Estoque abaixo do mínimo:', { saldoAtual, qtd, estoque_minimo }); // LOG DE DEBUG
                req.session.movimentoError = `Não é permitido deixar o estoque abaixo do mínimo (${estoque_minimo}).`;
                return res.redirect('/movimento');
            }
            
            novoSaldo = saldoAtual - qtd; // Diminui saldo
        } else {
            // Se for ENTRADA, apenas soma
            novoSaldo = saldoAtual + qtd;
        }

        console.log('✅ Novo saldo calculado:', novoSaldo); // LOG DE DEBUG

        // Registra o movimento no histórico
        await client.query(
            'INSERT INTO movimento_estoque (idproduto, tipo, quantidade, observacao) VALUES ($1, $2, $3, $4)',
            [idproduto, tipoMovimento, qtd, 
             tipoMovimento === 'E' ? 'Entrada de estoque' : 'Saída de estoque']
        );

        // Atualiza ou insere o saldo
        const updateResult = await client.query(
            'UPDATE saldos SET saldo = $1 WHERE idproduto = $2', 
            [novoSaldo, idproduto]
        );
        
        // Se não atualizou nada (saldo não existe), insere um novo registro
        if (updateResult.rowCount === 0) {
            console.log('📝 Criando novo registro de saldo para produto:', idproduto); // LOG DE DEBUG
            await client.query(
                'INSERT INTO saldos (idproduto, saldo) VALUES ($1, $2)',
                [idproduto, novoSaldo]
            );
        }
        
        // Confirma a transação
        await client.query('COMMIT');

        console.log('✅ Movimento processado com sucesso!'); // LOG DE DEBUG
        req.session.movimentoMessage = 'Movimento registrado com sucesso!';
        res.redirect('/movimento');
    } catch (err) {
        // Se houver erro, desfaz tudo
        await client.query('ROLLBACK');
        console.error('Erro ao processar movimento:', err);
        req.session.movimentoError = 'Erro ao registrar movimento.';
        res.redirect('/movimento');
    }
});

// ========================================
// 7. CONSULTA DE SALDO
// ========================================
// Exibe uma tabela com o saldo atual de todos os produtos

app.get('/saldo', requireLogin, async (req, res) => {
    try {
        // Busca todos os produtos com seus saldos
        const result = await client.query(`
            SELECT p.idproduto, p.nome, s.saldo
            FROM produto p
            LEFT JOIN saldos s ON p.idproduto = s.idproduto
            ORDER BY p.nome
        `);
        
        res.render('saldo', { saldos: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao consultar saldo.');
    }
});

// ========================================
// 8. CRUD DE CATEGORIAS
// ========================================
// Gerencia as categorias de produtos (mesma estrutura do CRUD de produtos)

// -------- READ (Listar) --------
app.get('/categorias', requireLogin, async (req, res) => {
    try {
        // Busca todas as categorias ordenadas por ID
        const result = await client.query(
            'SELECT idcategoria, nome, descricao FROM categoria ORDER BY idcategoria'
        );
        
        res.render('categorias', { 
            categorias: result.rows,
            error: req.session.categoriaError || null 
        });
        req.session.categoriaError = null;
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao listar categorias.');
    }
});

// -------- CREATE (Criar) --------
app.post('/categorias', requireLogin, async (req, res) => {
    const { nome, descricao } = req.body;
    
    // Nome é obrigatório
    if (!nome) {
        req.session.categoriaError = 'Nome da categoria é obrigatório.';
        return res.redirect('/categorias');
    }
    
    try {
        // Insere nova categoria
        await client.query(
            `INSERT INTO categoria (nome, descricao) VALUES ($1, $2)`,
            [nome, descricao || null]
        );
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.categoriaError = 'Erro ao cadastrar categoria.';
        res.redirect('/categorias');
    }
});

// -------- UPDATE (Editar) - Exibir --------
app.get('/categorias/editar/:idc', requireLogin, async (req, res) => {
    const { idc } = req.params; // ID da categoria
    
    try {
        // Busca a categoria
        const result = await client.query(
            `SELECT * FROM categoria WHERE idcategoria = $1`, 
            [idc]
        );
        
        if (result.rows.length === 0) return res.status(404).send('Categoria não encontrada.');
        
        res.render('editar_categorias', { categoria: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar categoria para edição.');
    }
});

// -------- UPDATE (Editar) - Processar --------
app.post('/categorias/atualizar/:idc', requireLogin, async (req, res) => {
    const { idc } = req.params;
    const { nome, descricao } = req.body;
    
    // Validação
    if (!nome) {
        req.session.categoriaError = 'Nome da categoria é obrigatório.';
        return res.redirect('/categorias');
    }
    
    try {
        // Atualiza a categoria
        await client.query(
            `UPDATE categoria SET nome = $1, descricao = $2 WHERE idcategoria = $3`,
            [nome, descricao || null, idc]
        );
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.categoriaError = 'Erro ao atualizar categoria.';
        res.redirect('/categorias');
    }
});

// -------- DELETE (Excluir) --------
app.post('/categorias/excluir/:idc', requireLogin, async (req, res) => {
    const { idc } = req.params;
    
    try {
        // Deleta a categoria
        await client.query('DELETE FROM categoria WHERE idcategoria = $1', [idc]);
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        
        // Verifica se há produtos associados
        if (err.code === '23503') { // Erro de constraint (tem produtos)
            req.session.categoriaError = 'Não é possível excluir categoria com produtos associados!';
        } else {
            req.session.categoriaError = 'Erro ao excluir categoria.';
        }
        res.redirect('/categorias');
    }
});

// ========================================
// 9. INICIALIZA O SERVIDOR
// ========================================
// Inicia o servidor na porta 3000
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});