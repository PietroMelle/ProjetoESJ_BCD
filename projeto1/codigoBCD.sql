-- =============================================
-- 1️⃣ Tabela de Usuários
-- =============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(20) NOT NULL
);

-- =============================================
-- 2️⃣ Tabela de Categorias
-- =============================================
CREATE TABLE categoria (
    idcategoria SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(500)
);

-- =============================================
-- 3️⃣ Tabela de Produtos
-- =============================================
CREATE TABLE produto (
    idproduto SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    codigo_interno VARCHAR(50) UNIQUE NOT NULL,
    idcategoria INTEGER REFERENCES categoria(idcategoria),
    fabricante VARCHAR(100),
    preco_venda NUMERIC(10,2) DEFAULT 0,
    voltagem VARCHAR(10),
    cor VARCHAR(50),
    peso NUMERIC(10,2),
    material VARCHAR(100),
    descricao VARCHAR(500),
    estoque_minimo INTEGER DEFAULT 0
);

-- =============================================
-- 4️⃣ Tabela de Saldos (controle atual de estoque)
-- =============================================
CREATE TABLE saldos (
    idproduto INTEGER PRIMARY KEY,
    saldo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (idproduto) REFERENCES produto(idproduto) ON DELETE CASCADE
);

-- =============================================
-- 5️⃣ Tabela de Movimentos (histórico de entradas e saídas)
-- =============================================
CREATE TABLE movimento_estoque (
    idmovimento SERIAL PRIMARY KEY,
    idproduto INTEGER REFERENCES produto(idproduto),
    tipo CHAR(1) CHECK (tipo IN ('E','S')),
    quantidade INTEGER CHECK (quantidade > 0),
    data_movimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacao VARCHAR(500)
);

-- =============================================
-- Inserts
-- =============================================

-- Usuário padrão
INSERT INTO usuarios (login, nome, senha) VALUES
('aluno', 'Aluno Teste', '12345');

-- Categorias
INSERT INTO categoria (nome, descricao) VALUES
('Notebook', 'Computadores portáteis de diferentes marcas e configurações'),
('Mouse', 'Dispositivos de entrada com fio ou sem fio'),
('HD Externo', 'Dispositivos de armazenamento portáteis');

-- Produtos
INSERT INTO produto (nome, codigo_interno, idcategoria, fabricante, preco_venda, voltagem, cor, peso, material, descricao, estoque_minimo) VALUES
('Notebook Dell Inspiron 15', 'NTB001', 1, 'Dell', 3500.00, 'Bivolt', 'Prata', 1.8, 'Alumínio', 'Notebook com tela de 15,6", ideal para uso doméstico e profissional', 2),
('Mouse Logitech M170', 'MOU001', 2, 'Logitech', 85.00, NULL, 'Preto', 0.09, 'Plástico', 'Mouse sem fio com receptor USB', 5),
('HD Externo Seagate 1TB', 'HDX001', 3, 'Seagate', 420.00, 'Bivolt', 'Preto', 0.25, 'Plástico', 'HD externo portátil de 1TB com conexão USB 3.0', 3);

-- Saldos (valores iniciais)
INSERT INTO saldos (idproduto, saldo) VALUES
(1, 5),
(2, 12),
(3, 8);

-- Movimentos iniciais		
INSERT INTO movimento_estoque (idproduto, tipo, quantidade, observacao) VALUES
(1, 'E', 5, 'Entrada inicial - Notebook Dell'),
(2, 'E', 12, 'Entrada inicial - Mouse Logitech'),
(3, 'E', 8, 'Entrada inicial - HD Externo Seagate');
