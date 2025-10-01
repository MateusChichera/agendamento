// services/whatsappService.js
// Polyfill para crypto (necessário para Baileys)
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto');
}

const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const db = require('../utils/database.js')
const fs = require('fs');
const path = require('path');

const conexao = new db();

let qrCodeData = null;
let clientReady = false;
let sock = null;

// Diretório para salvar a sessão
const authDir = path.join(__dirname, '../auth_info_baileys');

// Garantir que o diretório existe
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Logger customizado para o Baileys
const logger = {
  level: 'silent',
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
};

async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: logger,
      browser: ['Chrome', 'Linux', '116.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => ({ conversation: 'Mensagem não encontrada' })
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrcode.toDataURL(qr, (err, url) => {
          if (err) {
            console.error('Erro ao gerar o QR Code:', err);
            return;
          }
          qrCodeData = url;
        });
      }

      if (connection === 'close') {
        const status = lastDisconnect?.error?.output?.statusCode;
        console.log('Conexão fechada. status=', status, 'erro=', lastDisconnect?.error?.message);
        const shouldReconnect = status !== DisconnectReason.loggedOut;
        if (shouldReconnect) setTimeout(startWhatsApp, 5000);
        else console.log('Sessão expirada/loggedOut. Apague a pasta de sessão e reautentique.');
        clientReady = false;
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado');
        clientReady = true;
      }
    });

    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('Erro ao inicializar WhatsApp:', error);
    setTimeout(() => {
      startWhatsApp();
    }, 10000);
  }
}

// Inicializar WhatsApp
startWhatsApp();

// Espera até o cliente estar pronto
function esperarClientePronto() {
  if (clientReady) return Promise.resolve();
  return new Promise((resolve) => {
    const intervalo = setInterval(() => {
      if (clientReady) {
        clearInterval(intervalo);
        resolve();
      }
    }, 500);
  });
}

async function VizualizarMensagem(whatsappId) {
  try {
    await conexao.ExecutaComando(`
      UPDATE mensagens_enviadas
      SET resposta_vizualizada = 1
      WHERE whatsapp_id = ?
    `, [whatsappId]);
    return true;
  } catch (error) {
    console.error('Erro ao atualizar a vizualização da mensagem:', error);
    throw error;
  }
}

// Envia a mensagem com garantia de que o cliente está pronto
async function enviarMensagem(numero, mensagem, tecnicoId = null) {
  await esperarClientePronto();
  
  try {
    // Formatar número (remover caracteres especiais e adicionar @s.whatsapp.net)
    const numeroFormatado = numero.replace(/\D/g, '') + '@s.whatsapp.net';
    
    const sentMsg = await sock.sendMessage(numeroFormatado, { text: mensagem });
    
    // Registrar no banco (se for mensagem de agendamento)
    if (tecnicoId) {
      await conexao.ExecutaComando(`
        INSERT INTO mensagens_enviadas 
        (tecnico_id, whatsapp_id, mensagem_texto) 
        VALUES (?, ?, ?)
      `, [tecnicoId, sentMsg.key.id, mensagem]);
    }
    
    return sentMsg;
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro);
    throw erro;
  }
}

async function getQRCode() {
  if (!qrCodeData) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (qrCodeData) {
          clearInterval(interval);
          resolve(qrCodeData);
        }
      }, 500);

      // Adicionar um tempo limite para evitar espera indefinida
      setTimeout(() => {
        clearInterval(interval);
        reject('Erro: QR Code não gerado no tempo esperado');
      }, 60000); // Espera 1 minuto (60,000ms)
    });
  }
  return qrCodeData;
}

module.exports = {
  getQRCode,
  enviarMensagem,
  VizualizarMensagem
};
