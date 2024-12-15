let cors = require("cors");
let express = require("express");
let mysql = require("serverless-mysql");

const app = express();
const porta = 3000;

app.use(cors());
app.use(express.json());

let bd = mysql({
    config: {
        host: "127.0.0.1",
        database: "iftm_filmes",
        user: "root",
        password: "",
    },
});

app.get("/", (req, res) => {
    console.log("Servidor rodando local na porta 3000");
    res.send("<h1>testando</h1>");
})

app.get("/filmes/:pagina", async (req, res) => {
    let pagina = parseInt(req.params.pagina)
    let limite = 10
    let offset = (pagina - 1) * limite

    let filmes = await bd.query(`SELECT * FROM filmes LIMIT ?, ?`, [offset,limite,]);

    if (filmes.length === 0) {
        res.status(404).json({ mensagem: "Página não encontrado!" });
        return;
    }

    res.json(filmes);
    await bd.end();
})

app.get("/filme/:id", async (req, res) => {
    let id = parseInt(req.params.id)
    let filmes = await bd.query(`SELECT * FROM filmes WHERE id = ?`, [id]);
    if (filmes.length === 0) {
        res.status(404).json({ mensagem: "Não foi encontrado nenhum filme com esse id" });
        return;
    }
    res.json(filmes);
    await bd.end();
})

app.get("/filmes/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra
    let filmes = await bd.query(`SELECT * FROM filmes WHERE titulo LIKE '%${palavra}%' OR sinopse LIKE '%${palavra}%';`);
    if (filmes.length === 0) {
        res.status(404).json({ mensagem: "Não foi encontrado nenhum filme com essa palavra" });
        alert("Não foi encontrado nenhum filme com essa palavra")
        return;
    }
    res.json(filmes);
    await bd.end();
})

app.get("/generos/:genero", async (req, res) => {
    let genero = req.params.genero;
    let query = `
        SELECT 
            f.id AS filme_id,
            f.titulo AS filme_titulo
        FROM filmes f
        INNER JOIN filmes_generos fg ON f.id = fg.filme_id
        INNER JOIN generos g ON fg.genero_id = g.id
        WHERE g.titulo = ?
    `;
    let filmes = await bd.query(query, [genero]);

    if (filmes.length === 0) {
        res.status(404).json({ mensagem: "Não foi encontrado nenhum filme com esse gênero" });
        return;
    }

    res.json(filmes);
    await bd.end();
});

app.get("/ator/:id", async (req, res) => {
    let id = parseInt(req.params.id);
    let query = `
        SELECT 
            a.id AS ator_id,
            a.titulo AS ator_nome,
            f.id AS filme_id,
            f.titulo AS filme_nome
        FROM atores a
        LEFT JOIN atores_filmes af ON a.id = af.ator_id
        LEFT JOIN filmes f ON af.filme_id = f.id
        WHERE a.id = ?
    `;
    let atoresFilmes = await bd.query(query, [id]);

    if (atoresFilmes.length === 0) {
        res.status(404).json({ mensagem: "Não foi encontrado nenhum ator com esse id" });
        return;
    }

    let resultado = {
        ator_id: atoresFilmes[0].ator_id,
        ator_nome: atoresFilmes[0].ator_nome,
        filmes: []
    };

    atoresFilmes.forEach(row => {
        if (row.filme_id) {
            resultado.filmes.push({
                filme_id: row.filme_id,
                filme_nome: row.filme_nome
            });
        }
    });

    res.json(resultado);
    await bd.end();
});

app.get("/atores/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra;
    let query = `
        SELECT 
            a.id AS ator_id, 
            a.titulo AS ator_nome, 
            GROUP_CONCAT(f.titulo SEPARATOR ', ') AS filmes
        FROM atores a
        LEFT JOIN atores_filmes af ON a.id = af.ator_id
        LEFT JOIN filmes f ON af.filme_id = f.id
        WHERE a.titulo LIKE ?
        GROUP BY a.id, a.titulo;
    `;
    let atoresFilmes = await bd.query(query, [`%${palavra}%`]);

    if (atoresFilmes.length === 0) {
        res.status(404).json({ mensagem: "Não foi encontrado nenhum ator com essa palavra" });
        return;
    }

    let resultado = atoresFilmes.map(row => ({
        ator_id: row.ator_id,
        ator_nome: row.ator_nome,
        filmes: row.filmes ? row.filmes.split(', ') : []
    }));

    res.json(resultado);
    await bd.end();
});

app.post("/atores", async (req, res) => {
    try {
        let { titulo } = req.body;
        let atores = await bd.query(
            `INSERT INTO atores (titulo) VALUES (?)`,
            [titulo]
        );
        console.log("Ator cadastrado com sucesso!");
        
        res.json({ id: atores.insertId, titulo });
    } catch (error) {
        console.error("Erro ao cadastrar ator:", error);
        res.status(500).json({ mensagem: "Erro ao cadastrar ator" });
    } finally {
        await bd.end();
    }
});
app.put("/atores", async (req, res) => {
    try {
        let { id, titulo } = req.body;
        let atores = await bd.query(
            `UPDATE atores SET titulo = ? WHERE id = ?`,
            [titulo, id]
        );
        console.log("Ator atualizado com sucesso!");
        
        res.json({ id, titulo });
    } catch (error) {
        console.error("Erro ao atualizar ator:", error);
        res.status(500).json({ mensagem: "Erro ao atualizar ator" });
    } finally {
        await bd.end();
    }
});

app.delete("/atores/:id", async (req, res) => {
    let id = parseInt(req.params.id);
    try {
        // Remover registros da tabela atores_filmes
        await bd.query(`DELETE FROM atores_filmes WHERE ator_id = ?`, [id]);

        // Remover o ator da tabela atores
        await bd.query(`DELETE FROM atores WHERE id = ?`, [id]);

        console.log("Ator e registros vinculados deletados com sucesso!");
        res.json({ id, mensagem: "Ator deletado com sucesso!" });
    } catch (error) {
        console.error("Erro ao deletar ator:", error);
        res.status(500).json({ mensagem: "Erro ao deletar ator" });
    } finally {
        await bd.end();
    }
});

app.post("/participacoes/:idAtor/:idFilme", async (req, res) => {
    try {
        let idAtor = parseInt(req.params.idAtor);
        let idFilme = parseInt(req.params.idFilme);
        let participacoes = await bd.query(
            `INSERT INTO atores_filmes (ator_id, filme_id) VALUES (?, ?)`,
            [idAtor, idFilme]
        );
        console.log("Participação cadastrada com sucesso!");
        res.json({ id: participacoes.insertId, idAtor, idFilme });
    } catch (error) {
        console.error("Erro ao cadastrar participação:", error);
        res.status(500).json({ mensagem: "Erro ao cadastrar participação" });
    } finally {
        await bd.end();
    }
});

app.delete("/participacoes/:idAtor/:idFilme", async (req, res) => {
    let idAtor = parseInt(req.params.idAtor);
    let idFilme = parseInt(req.params.idFilme);
    try {
        let participacoes = await bd.query(
            `DELETE FROM atores_filmes WHERE ator_id = ? AND filme_id = ?`,
            [idAtor, idFilme]
        );
        console.log("Participação deletada com sucesso!");
        res.json({ idAtor, idFilme, mensagem: "Participação deletada com sucesso!" });
    } catch (error) {
        console.error("Erro ao deletar participação:", error);
        res.status(500).json({ mensagem: "Erro ao deletar participação" });
    } finally {
        await bd.end();
    }
});

app.listen(porta, () => { console.log(`Servidor rodando em http://127.0.0.1:${porta}`); });