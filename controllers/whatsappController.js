const whatsappService = require('../services/whatsappService.js');
const db = require('../utils/database.js');

const conexao = new db();

class WhatsappController {
  async gerarQRCode(req, res) {
    const qrCode = await whatsappService.getQRCode();
    if (qrCode) {
      res.render('whatsapp/qrcode', { qrCode });
    } else {
      res.send("Aguardando geração do QR Code...");
    }
  }

  async getQRCodeImage(req, res) {
    const qrCode = await whatsappService.getQRCode();
    if (qrCode) {
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length
      });
      res.end(imgBuffer);
    } else {
      res.status(404).send("QR Code ainda não gerado.");
    }
  }

  async enviarMensagem(req, res) {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
      return res.status(400).json({ erro: 'Número e mensagem são obrigatórios' });
    }

    try {
      await whatsappService.enviarMensagem(numero, mensagem);
      res.json({ status: 'ok', mensagem: 'Mensagem enviada com sucesso!' });
    } catch (erro) {
      res.status(500).json({ erro: 'Erro ao enviar mensagem', detalhes: erro });
    }
  }

  // Função para verificar respostas (substitui o monitor)
  async VerificarResposta(req, res) {
    try {
      const mensagens = await conexao.ExecutaComando(`
        SELECT u.usuid, u.usunome, m.resposta_texto, m.data_resposta, m.id AS mensagem_id, m.resposta_vizualizada
        FROM Usuario u
        INNER JOIN mensagens_enviadas m ON u.usuid = m.tecnico_id
        WHERE m.resposta_recebida = 1 AND m.resposta_vizualizada = 0;
      `);

      if (mensagens.length > 0) {
        res.json({ status: 'ok', mensagem: 'Confirmações encontradas!', mensagens });
      } else {
        res.json({ status: 'ok', mensagem: 'Nenhuma confirmação pendente', mensagens: [] });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar resposta na controller:', error);
      res.status(500).json({ status: 'error', mensagem: 'Erro ao verificar resposta', error: error.message });
    }
  }

  // Função para marcar notificação como lida
  async MarcarNotificacaoComoLida(req, res) {
    const { mensagemId } = req.body;
    if (!mensagemId) {
      return res.status(400).json({ status: 'error', mensagem: 'ID da mensagem não fornecido.' });
    }
    try {
      await conexao.ExecutaComando(`
        UPDATE mensagens_enviadas
        SET resposta_vizualizada = 1
        WHERE id = ?;
      `, [mensagemId]);
      
      res.json({ status: 'ok', mensagem: `Mensagem ${mensagemId} marcada como visualizada.` });
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida na controller:', error);
      res.status(500).json({ status: 'error', mensagem: 'Erro ao marcar notificação como lida', error: error.message });
    }
  }
}

module.exports = WhatsappController;
