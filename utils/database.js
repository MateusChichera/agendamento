var mysql = require('mysql2');

class Database {
    #conexao;

    get conexao() { return this.#conexao; }
    set conexao(conexao) { this.#conexao = conexao; }

    constructor() {
        this.#conexao = mysql.createPool({
            host: '127.0.0.1',
            database: 'projetohoras',
            user: 'remoto',
            password: 'masterkey',
        });

        // Testa a conexão logo ao criar
        this.#conexao.getConnection((err, conn) => {
            if (err) {
                console.error("❌ Erro ao conectar no MySQL:", err.message);
            } else {
                console.log("✅ Conectado ao banco de dados:", conn.config.database);
                conn.release(); // libera a conexão de volta pro pool
            }
        });
    }

    ExecutaComando(sql, valores) {
        var cnn = this.#conexao;
        return new Promise(function (res, rej) {
            cnn.query(sql, valores, function (error, results, fields) {
                if (error)
                    rej(error);
                else
                    res(results);
            });
        })
    }

    ExecutaComandoNonQuery(sql, valores) {
        var cnn = this.#conexao;
        return new Promise(function (res, rej) {
            cnn.query(sql, valores, function (error, results, fields) {
                if (error)
                    rej(error);
                else
                    res(results.affectedRows > 0);
            });
        })
    }

    ExecutaComandoLastInserted(sql, valores) {
        var cnn = this.#conexao;
        return new Promise(function (res, rej) {
            cnn.query(sql, valores, function (error, results, fields) {
                if (error)
                    rej(error);
                else
                    res(results.insertId);
            });
        })
    }
}

module.exports = Database;
