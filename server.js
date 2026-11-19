// ============================================================
// Server.js — 亗 ʙᴏᴛ ᴘᴀɪʀɪɴɢ 亗 (Mr Kira Tech)
// Module Telegram (commandes) + pairing WhatsApp (Baileys) + Express (Render)
//
// BOUTONS COLORÉS :
//   Depuis la Bot API 9.4 (fév. 2026), chaque bouton inline accepte un champ
//   "style" : "primary" (bleu), "success" (vert), "danger" (rouge).
//   Les boutons "secondary" gardent le style par défaut (gris).
//   Nécessite une appli Telegram à jour côté utilisateur.
//
// .env attendu :
//   TELEGRAM_BOT_TOKEN=...
//   PORT=10000                 (fourni par Render automatiquement)
//   PUB_IMAGE_URL=...
//   PUB_VIDEO_URL=...
// ============================================================

require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');

const { startWhatsAppPubs, stopWhatsAppPubs } = require('./Pub.js');

const logger = pino({ level: 'info' });

// ==== IDENTITÉ DU BOT ====
const BOT_NAME = '亗 ʙᴏᴛ ᴘᴀɪʀɪɴɢ 亗';
const BOT_AUTHOR = '༑𝐌𝐑⌁⃰ ƘƖ𝐑𝚫̊͜͡ 𝐃𝚵𝐕';
const BOT_LINK = 'https://t.me/Kira_ban_permanent_bot';
const SUPPORT_USERNAME = 'KIRA_SUPPORT_HUB';
const ADMIN_SECRET = 'Mana2011@'; // commande spéciale génération de codes promo

// ==== IMAGES / VIDÉOS (éditables) ====
const IMG_MAIN = 'https://i.ibb.co/KzrHJK9n/104-E0729-C3-D5-40-EF-AE83-54-A38728-CD1-E.png';
const IMG_LINK = 'https://i.ibb.co/Q7PBzYPB/493-EF3-CC-DE22-4-CB7-96-A1-8-EF824-E1-C27-A.jpg';
const IMG_CONTACT = 'https://i.ibb.co/3y0Rqpxg/D218-ABE1-CDA8-4-D8-B-A8-C4-B881-F525-A77-A.jpg';
const IMG_INVITE = 'https://i.ibb.co/XxXjQrz1/2-AA09778-FC42-4-AD4-ACA7-1-C8-C74270907.jpg';
const IMG_WA_CONNECTED = 'https://i.ibb.co/k2jhN738/B7-C3801-F-71-BD-4998-8-C6-B-7-A294-DDB19-CF.jpg';
const VID_HELP = process.env.HELP_VIDEO_URL || 'https://yourimageshare.com/ib/F6pf5dViTn.mp4';

const LIENS = {
  channelTelegram: 'https://t.me/+mQ3aQpCsEqI0YmY0',
  groupe1: 'https://t.me/+2JDC_Be4_ww1N2Vk',
  groupe2: 'https://t.me/+Z-P_xjUgJjU0MjM0',
  channelWhatsApp: 'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X',
  groupeWhatsApp: 'https://chat.whatsapp.com/IP0nFB79rMDF0nvFSMXtDR',
};

// ==== STOCKAGE JSON (base légère, sans dépendance externe) ====
const DATA_DIR = path.join(__dirname, 'sessions');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB = {
  users: {},      // telegramId -> { credits, freeTrialUsed, referralCode, referredBy, pairings: [] }
  codes: {},      // code -> { reward, usedBy: [telegramId...], expiresAt: null|ISOstring }
  pairedNumbers: [], // { number, telegramId, connectedAt }
};

async function loadDb() {
  await fs.ensureDir(DATA_DIR);
  await fs.ensureFile(DB_FILE);
  const raw = await fs.readFile(DB_FILE, 'utf-8');
  if (!raw.trim()) return JSON.parse(JSON.stringify(DEFAULT_DB));
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

async function saveDb(db) {
  await fs.ensureDir(DATA_DIR);
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(db, id) {
  if (!db.users[id]) {
    db.users[id] = {
      credits: 0,
      freeTrialUsed: false,
      referralCode: null,
      referredBy: null,
      pairings: [],
    };
  }
  return db.users[id];
}

function generateReferralCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const d2 = digits[Math.floor(Math.random() * 10)] + digits[Math.floor(Math.random() * 10)];
  const l = letters[Math.floor(Math.random() * letters.length)];
  const d1 = digits[Math.floor(Math.random() * 10)];
  return `KIRABOT${d2}${l}${d1}`;
}

function generatePromoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function maskNumber(num) {
  // +242 06•• ••• •75  (masque tout sauf indicatif + 2 premiers + 2 derniers chiffres)
  const digits = String(num).replace(/\D/g, '');
  if (digits.length < 6) return `+${digits}`;
  const start = digits.slice(0, 5);
  const end = digits.slice(-2);
  return `+${start}•• ••• •${end}`;
}

// ==== BOUTONS COLORÉS (vrai champ "style" de la Bot API 9.4) ====
const STYLES = { primary: 'primary', success: 'success', danger: 'danger' };

function btn(color, label, extra) {
  const b = { text: label, ...extra };
  if (STYLES[color]) b.style = STYLES[color]; // secondary => style par défaut
  return b;
}

// ============================================================
// ==== EXPRESS (obligatoire pour Render Web Service) ====
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => res.status(200).send(`${BOT_NAME} — en ligne ✅`));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', bot: BOT_NAME }));

const server = app.listen(PORT, () => {
  logger.info(`[EXPRESS] Serveur actif sur le port ${PORT}`);
});

// ============================================================
// ==== TELEGRAM BOT ====
// ============================================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN manquant dans .env — arrêt.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ---- /start ----
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const db = await loadDb();
  const user = getUser(db, chatId);
  const payload = match[1] && match[1].trim();

  // Parrainage : /start KIRABOTXXXX
  if (payload && payload.startsWith('KIRABOT')) {
    const code = payload.toUpperCase();
    const sponsorId = Object.keys(db.users).find(
      (uid) => db.users[uid].referralCode === code && String(uid) !== String(chatId)
    );
    if (sponsorId && !user.referredBy) {
      user.referredBy = sponsorId;
      const sponsor = getUser(db, sponsorId);
      sponsor.credits += 1;
      await saveDb(db);

      await bot.sendMessage(
        sponsorId,
        `✨━━━━━━━━━━━━━━━━━━━━✨\n   🎉🎊  𝐅𝐄́𝐋𝐈𝐂𝐈𝐓𝐀𝐓𝐈𝐎𝐍𝐒 !  🎊🎉\n✨━━━━━━━━━━━━━━━━━━━━✨\n\n╔══════════════════════════╗\n   💳 𝐂𝐫𝐞́𝐝𝐢𝐭   ➜   +𝟏 🌀\n   🎁 𝟏 𝐢𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧  = 𝟏 𝐜𝐫𝐞́𝐝𝐢𝐭 ✅\n╚══════════════════════════╝\n\n   🏆  𝐓𝐨𝐭𝐚𝐥 :  ${sponsor.credits} / 𝟓 𝐜𝐫𝐞́𝐝𝐢𝐭𝐬\n\n╭──────────────────────────╮\n   🔥  𝐂𝐨𝐧𝐭𝐢𝐧𝐮𝐞 𝐜𝐨𝐦𝐦𝐞 𝐜̧𝐚 !  🔥\n╰──────────────────────────╯`
      );

      if (sponsor.credits >= 5) {
        await bot.sendMessage(
          sponsorId,
          `✨━━━━━━━━━━━━━━━━━━━━✨\n   🏆  𝐁𝐎𝐓 𝐃𝐄́𝐁𝐋𝐎𝐐𝐔𝐄́ !  🏆\n✨━━━━━━━━━━━━━━━━━━━━✨\n\n╔══════════════════════════╗\n   💳 𝐂𝐫𝐞́𝐝𝐢𝐭𝐬 :  ${sponsor.credits} / 𝟓  ✅\n   🔓 𝐀𝐜𝐜𝐞̀𝐬   :  𝐀𝐔𝐓𝐎𝐑𝐈𝐒𝐄́\n╚══════════════════════════╝\n\n   🚀  Tu peux maintenant /pair !`,
          { reply_markup: { inline_keyboard: [[btn('success', 'Commencer le pairing', { callback_data: 'go_pair' })]] } }
        );
      }
    }
  }

  await saveDb(db);

  const text =
`════════════════════════════════════
   ✦  WELCOME IN BOT PARING ✦
══════════════════

🔒 RESTRICTED ACCESS

⚠️ To use this bot, you must join:

  •📢 CHANNEL TÉLÉGRAM
  •1️⃣ GROUPE TÉLÉGRAM 1
  •2️⃣ GROUPE TÉLÉGRAM 2
  •🌐 GROUPE WHATSAPP
  •📢 CHANNEL WHATSAPP

NB: Join them then click continuer✅
──────────────────────────────────────`;

  await bot.sendPhoto(chatId, IMG_MAIN, {
    caption: text,
    reply_markup: {
      inline_keyboard: [
        [btn('primary', '📢 Chaîne Telegram', { url: LIENS.channelTelegram })],
        [btn('primary', '1️⃣ Groupe 1', { url: LIENS.groupe1 })],
        [btn('primary', '2️⃣ Groupe 2', { url: LIENS.groupe2 })],
        [btn('primary', '📢 Chaîne WhatsApp', { url: LIENS.channelWhatsApp })],
        [btn('primary', '🌐 Groupe WhatsApp', { url: LIENS.groupeWhatsApp })],
        [btn('success', 'CONTINUER ✅', { callback_data: 'continuer' })],
      ],
    },
  });
});

// ---- /menu ----
async function sendMenu(chatId) {
  const text =
`━━━━━━━━━━━━━━━━━━━
╔══════════════════════════╗
📜 COMMANDES TÉLÉGRAM
╚══════════════════════════╝

▶️ /start ➜ Démarrer le bot
📋 /menu ➜ Afficher le menu
❓ /help ➜ Aide
🔗 /pair ➜ Lancer un appairage
📲 /link ➜ Obtenir le lien
📩 /contact ➜ Nous contacter
🎁 /code ➜ Codes promos
📈 /user ➜ Nombre d'utilisateurs
📊 /classement ➜ Le top 10 de meilleur paring
━━━━━━━━━━━━━━━━━━━`;

  await bot.sendPhoto(chatId, IMG_MAIN, {
    caption: text,
    reply_markup: { inline_keyboard: [[btn('success', 'Commencer ➜ /pair', { callback_data: 'go_pair' })]] },
  });
}
bot.onText(/^\/menu$/, (msg) => sendMenu(msg.chat.id));

// ---- /help ----
bot.onText(/^\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
`✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨
   🤖  𝐁𝐎𝐓 𝐏𝐀𝐈𝐑𝐈𝐍𝐆  ➜  𝐌𝐑 𝐊𝐈𝐑𝐀 𝐓𝐄𝐂𝐇  🤖
✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨

╔══════════════════════════╗
   📖  𝐆𝐔𝐈𝐃𝐄 𝐃'𝐔𝐓𝐈𝐋𝐈𝐒𝐀𝐓𝐈𝐎𝐍
╚══════════════════════════╝

  ❶  📲  𝐓𝐚𝐩𝐞𝐳  ➜  /pair 242…
  ❷  🔑  𝐑𝐞𝐜𝐞𝐯𝐞𝐳 𝐮𝐧 𝐜𝐨𝐝𝐞 ➜ 𝟖 𝐜𝐡𝐢𝐟𝐟𝐫𝐞𝐬
  ❸  🔗  𝐄𝐧𝐭𝐫𝐞𝐳-𝐥𝐞 𝐝𝐚𝐧𝐬 WhatsApp ➜ 𝐀𝐩𝐩𝐚𝐫𝐞𝐢𝐥𝐬 𝐥𝐢𝐞́𝐬
  ❹  ✅  𝐂𝐨𝐧𝐧𝐞𝐱𝐢𝐨𝐧 𝐫𝐞́𝐮𝐬𝐬𝐢𝐞 !

╔══════════════════════════╗
   🆘  𝐃𝐄́𝐏𝐀𝐍𝐍𝐀𝐆𝐄 𝐑𝐀𝐏𝐈𝐃𝐄
╚══════════════════════════╝

  ⚠️  𝐂𝐨𝐝𝐞 𝐢𝐧𝐯𝐚𝐥𝐢𝐝𝐞 ? ➜ vérifie les 𝟖 𝐜𝐡𝐢𝐟𝐟𝐫𝐞𝐬
  ⚠️  𝐍𝐮𝐦𝐞́𝐫𝐨 𝐫𝐞𝐟𝐮𝐬𝐞́ ? ➜ /pair 242XXXXXXX (sans « + »)
  ⚠️  𝐁𝐨𝐭 𝐢𝐧𝐚𝐜𝐭𝐢𝐟 ? ➜ /start puis /menu`;

  await bot.sendVideo(chatId, VID_HELP, {
    caption: text,
    reply_markup: {
      inline_keyboard: [
        [btn('primary', 'Nous contacter', { callback_data: 'go_contact' }), btn('success', 'Canal', { url: LIENS.channelTelegram })],
      ],
    },
  });
});

// ---- /pair ----
async function sendPairHome(chatId, db) {
  const user = getUser(db, chatId);
  const text =
`╔══════════════════════════════╗
   🕷  𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐏𝐀𝐈𝐑𝐈𝐍𝐆 𝐁𝐎𝐓  🚫
╚══════════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
   📡  𝐒𝐓𝐀𝐓𝐔𝐒   ➜   🟢 𝐎𝐍𝐋𝐈𝐍𝐄
   💰  𝐂𝐑𝐄́𝐃𝐈𝐓𝐒   ➜   ${user.credits} / 𝟓
   👤  𝐑𝐎̂𝐋𝐄   ➜   𝐏𝐀𝐈𝐑𝐈𝐍𝐆 𝐁𝐎𝐓
   👑  𝐃𝐄𝐕   ➜   ${BOT_AUTHOR}
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

╭─────────────────────────╮
   🎯  𝐇𝐎𝐖 𝐈𝐓 𝐖𝐎𝐑𝐊𝐒
╰─────────────────────────╯

  ❶  📲  Envoie : /pair 242XXXXXXX
  ❷  🔑  Reçois un code (𝟖 𝐜𝐡𝐢𝐟𝐟𝐫𝐞𝐬)
  ❸  🔗  Entre-le dans WhatsApp ➜ Appareils liés
  ❹  ⚠️  Le numéro est 𝐁𝐀𝐍𝐍𝐄́ auto
  ❺  💰  Coût : 𝟓 𝐜𝐫𝐞́𝐝𝐢𝐭𝐬

⌨️  𝐄𝐱𝐞𝐦𝐩𝐥𝐞  ➜  /pair 242061167625

╭─────────────────────────╮
   🔥  𝐏𝐨𝐰𝐞𝐫 𝐛𝐲 𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡 🌐
╰─────────────────────────╯`;

  await bot.sendPhoto(chatId, IMG_MAIN, {
    caption: text,
    reply_markup: {
      inline_keyboard: [
        [btn('primary', 'Credit', { callback_data: 'menu_credit' })],
        [btn('success', 'Essaie gratuit', { callback_data: 'free_trial' })],
      ],
    },
  });
}

bot.onText(/^\/pair(?:\s+(\d+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const number = match[1];
  const db = await loadDb();
  const user = getUser(db, chatId);

  if (!number) {
    await sendPairHome(chatId, db);
    return;
  }

  if (!/^\d{8,15}$/.test(number)) {
    await bot.sendMessage(
      chatId,
      `╭─────────────────────────╮\n   ⚠️  𝐄𝐑𝐑𝐄𝐔𝐑 𝐃𝐄 𝐅𝐎𝐑𝐌𝐀𝐓\n╰─────────────────────────╯\n\n🔗  𝐀𝐩𝐩𝐚𝐢𝐫𝐚𝐠𝐞 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩\n\n📌  𝐔𝐬𝐚𝐠𝐞 :\n      ➜  /pair 242XXXXXXXX\n\n🚫  𝐍𝐞 𝐦𝐞𝐭𝐬 𝐩𝐚𝐬 𝐥𝐞 « + » devant le numéro.\n🙏  𝐌𝐞𝐫𝐜𝐢.`
    );
    return;
  }

  const canFreeTrial = !user.freeTrialUsed;
  const canPaid = user.credits >= 5;

  if (!canFreeTrial && !canPaid) {
    await bot.sendMessage(
      chatId,
      `╭─────────────────────────╮\n   🔒  𝐀𝐂𝐂𝐄̀𝐒 𝐁𝐋𝐎𝐐𝐔𝐄́\n╰─────────────────────────╯\n\n   ✅  𝐄𝐬𝐬𝐚𝐢 𝐠𝐫𝐚𝐭𝐮𝐢𝐭 𝐮𝐭𝐢𝐥𝐢𝐬𝐞́\n   💰  𝐂𝐫𝐞́𝐝𝐢𝐭𝐬 :  ${user.credits} / 𝟓\n\n╭─────────────────────────╮\n   𝐓𝐫𝐨𝐢𝐬 𝐦𝐨𝐲𝐞𝐧𝐬 𝐩𝐨𝐮𝐫\n   𝐜𝐨𝐧𝐭𝐢𝐧𝐮𝐞𝐫 👇\n╰─────────────────────────╯`,
      {
        reply_markup: {
          inline_keyboard: [
            [btn('primary', 'Payer 10 Stars', { callback_data: 'pay_stars' })],
            [btn('danger', 'Code Promo', { callback_data: 'go_code' })],
            [btn('success', 'Inviter 5 amis', { callback_data: 'go_invite' })],
          ],
        },
      }
    );
    return;
  }

  await bot.sendMessage(chatId, `📡  𝐃𝐞𝐦𝐚𝐧𝐝𝐞 𝐞𝐧 𝐜𝐨𝐮𝐫𝐬 𝐩𝐨𝐮𝐫  +${number}… 🔄\n\n⏳  𝐏𝐚𝐭𝐢𝐞𝐧𝐭𝐞 𝐮𝐧 𝐢𝐧𝐬𝐭𝐚𝐧𝐭…`);

  try {
    const code = await requestWhatsAppPairingCode(number, msg.from.id);

    if (canFreeTrial) {
      user.freeTrialUsed = true;
    } else {
      user.credits -= 5;
    }
    user.pairings.push({ number, requestedAt: new Date().toISOString() });
    await saveDb(db);

    await bot.sendPhoto(chatId, IMG_MAIN, {
      caption:
`━━━━━━━━━━━━━━━━━━━━━━━━━━
   📲  𝐏𝐀𝐈𝐑𝐈𝐍𝐆 𝐂𝐎𝐃𝐄 ☑️
━━━━━━━━━━━━━━━━━━━━━━━━━━

   📞  𝐍𝐮𝐦𝐞́𝐫𝐨  ➜  +${number}

╔══════════════════════════╗
   🔑   │  \`${code}\`  │
╚══════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━
   📌  𝐄𝐧𝐭𝐫𝐞 𝐜𝐞 𝐜𝐨𝐝𝐞 𝐝𝐚𝐧𝐬
        WhatsApp ➜ 𝐀𝐩𝐩𝐚𝐫𝐞𝐢𝐥𝐬 𝐥𝐢𝐞́𝐬
━━━━━━━━━━━━━━━━━━━━━━━━━━
   🔥  𝐏𝐨𝐰𝐞𝐫 𝐛𝐲 𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡 🌐`,
      reply_markup: {
        inline_keyboard: [
          [btn('primary', 'Copier', { callback_data: `copy_${code}` })],
          [btn('secondary', 'Check', { callback_data: 'check_connected' })],
        ],
      },
    });
  } catch (err) {
    logger.error(err, 'Erreur pairing');
    await bot.sendMessage(chatId, `❌ Impossible de générer le code pour +${number}. Réessaie dans un instant.`);
  }
});

// ---- /link ----
bot.onText(/^\/link$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendPhoto(chatId, IMG_LINK, {
    caption: 'Rejoind nos canaux officiel 📈',
    reply_markup: {
      inline_keyboard: [
        [btn('primary', '📢 Chaîne Telegram', { url: LIENS.channelTelegram })],
        [btn('primary', '1️⃣ Groupe 1', { url: LIENS.groupe1 })],
        [btn('primary', '2️⃣ Groupe 2', { url: LIENS.groupe2 })],
        [btn('primary', '📢 Chaîne WhatsApp', { url: LIENS.channelWhatsApp })],
        [btn('primary', '🌐 Groupe WhatsApp', { url: LIENS.groupeWhatsApp })],
        [btn('success', 'Valider ✅', { callback_data: 'continuer' })],
      ],
    },
  });
});

// ---- /contact ----
async function sendContact(chatId) {
  await bot.sendPhoto(chatId, IMG_CONTACT, {
    caption: `📩 Support Kira Tech\nClique sur le bouton ci-dessous pour contacter l'équipe.`,
    reply_markup: { inline_keyboard: [[btn('primary', 'Contacter le support', { url: `https://t.me/${SUPPORT_USERNAME}` })]] },
  });
}
bot.onText(/^\/contact$/, (msg) => sendContact(msg.chat.id));

// ---- /user ----
bot.onText(/^\/user$/, async (msg) => {
  const chatId = msg.chat.id;
  const db = await loadDb();
  const totalUsers = Object.keys(db.users).length;
  const totalPairings = db.pairedNumbers.length;
  const text =
`━━━━━━━━━━━━━━━━━━━
   🚫   𝐏𝐀𝐈𝐑𝐈𝐍𝐆  𝐁𝐎𝐓  🚫
   ⚜️  𝐁𝐲 𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡  ⚜️
━━━━━━━━━━━━━━━━━━
╔══════════════════════════╗
   👥  𝐍𝐎𝐌𝐁𝐑𝐄  𝐃'𝐔𝐓𝐈𝐋𝐈𝐒𝐀𝐓𝐄𝐔𝐑𝐒
╚══════════════════════════╝
       🚹🚺  ➜  ${totalUsers}   𝐮𝐬𝐞𝐫𝐬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   📊  𝐒𝐭𝐚𝐭𝐬  𝐝𝐮  𝐛𝐨𝐭  :
   ➜  👥 𝐔𝐬𝐞𝐫𝐬       :  ${totalUsers}
   ➜  🔗 𝐏𝐚𝐢𝐫𝐚𝐠𝐞𝐬    :  ${totalPairings}
   ➜  🟢 𝐄𝐧 𝐥𝐢𝐠𝐧𝐞    :  ${totalPairings}
━━━━━━━━━━━━━━━━━━━`;

  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [btn('success', 'Commencer à utiliser', { callback_data: 'go_start' })],
        [btn('primary', 'Témoignages', { callback_data: 'testimonials_1' })],
      ],
    },
  });
});

// ---- Témoignages paginés (numéros masqués) ----
async function sendTestimonialsPage(chatId, page, messageId) {
  const db = await loadDb();
  const perPage = 10;
  const numbers = db.pairedNumbers.map((p) => p.number);
  const totalPages = Math.max(1, Math.ceil(numbers.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (!numbers.length) {
    const text = `━━━━━━━━━━━━━━━━━━━\n   📢  𝐓𝐄́𝐌𝐎𝐈𝐆𝐍𝐀𝐆𝐄𝐒  📢\n━━━━━━━━━━━━━━━━━━━\n\n╔══════════════════════════╗\n   📭  𝐀𝐔𝐂𝐔𝐍 𝐍𝐔𝐌𝐄́𝐑𝐎\n       𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄́ 𝐏𝐎𝐔𝐑 𝐋'𝐈𝐍𝐒𝐓𝐀𝐍𝐓\n╚══════════════════════════╝`;
    const markup = { inline_keyboard: [[btn('success', 'Lancer un pairing', { callback_data: 'go_pair' })]] };
    return messageId
      ? bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: markup })
      : bot.sendMessage(chatId, text, { reply_markup: markup });
  }

  const slice = numbers.slice((safePage - 1) * perPage, safePage * perPage);
  const lines = slice.map((n, i) => `  ${i + 1}️⃣  ${maskNumber(n)}`).join('\n');

  const text =
`╔══════════════════════════╗
   📞  𝐍𝐔𝐌𝐄́𝐑𝐎𝐒  𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄́𝐒
   📄  𝐏𝐚𝐠𝐞  ➜  ${safePage} / ${totalPages}
╚══════════════════════════╝

${lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const navRow = [];
  if (safePage > 1) navRow.push(btn('secondary', '⬅️ PRÉCÉDENT', { callback_data: `testimonials_${safePage - 1}` }));
  if (safePage < totalPages) navRow.push(btn('primary', '➡️ SUITE', { callback_data: `testimonials_${safePage + 1}` }));

  const markup = { inline_keyboard: navRow.length ? [navRow] : [] };

  return messageId
    ? bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: markup })
    : bot.sendMessage(chatId, text, { reply_markup: markup });
}

// ---- /invite ----
async function sendInviteHome(chatId) {
  await bot.sendPhoto(chatId, IMG_INVITE, {
    caption:
`╭─────────────────────────────╮
   💎  𝐒𝐘𝐒𝐓𝐄̀𝐌𝐄 𝐃𝐄 𝐏𝐀𝐑𝐑𝐀𝐈𝐍𝐀𝐆𝐄  💎
╰─────────────────────────────╯

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💳  𝐂𝐎𝐌𝐌𝐄𝐍𝐓 𝐎𝐁𝐓𝐄𝐍𝐈𝐑 𝐃𝐄𝐒 𝐂𝐑𝐄́𝐃𝐈𝐓𝐒 ?
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

   🌀 𝟏 𝐢𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧  ➜  🎁 𝟏 𝐜𝐫𝐞́𝐝𝐢𝐭

   📌  𝐍𝐁 :  Pour gagner 1 crédit,
   invite une personne à utiliser ce bot
   avec ton code de parrainage unique.

╭─────────────────────────────╮
   🔥  𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐁𝐚𝐧 𝐏𝐚𝐢𝐫𝐢𝐧𝐠  🔥
╰─────────────────────────────╯`,
    reply_markup: {
      inline_keyboard: [
        [btn('success', 'Inviter des personnes', { callback_data: 'invite_show_code' })],
        [btn('secondary', 'Retour', { callback_data: 'go_menu' })],
      ],
    },
  });
}
bot.onText(/^\/invite$/, (msg) => sendInviteHome(msg.chat.id));

// ---- /classement ----
bot.onText(/^\/classement$/, async (msg) => {
  const chatId = msg.chat.id;
  const db = await loadDb();
  const ranking = Object.entries(db.users)
    .map(([id, u]) => ({ id, pairings: u.pairings.length }))
    .sort((a, b) => b.pairings - a.pairings)
    .slice(0, 10);

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = ranking.length
    ? ranking.map((r, i) => `   ${medals[i]}  ➜  ID ${r.id}   ┃  ${r.pairings} 𝐩𝐚𝐢𝐫𝐬`).join('\n')
    : '   📭  Aucun classement pour le moment';

  const text =
`╔══════════════════════════════╗
   ⚜️  𝐓𝐎𝐏 𝟏𝟎  𝐃𝐄𝐒  𝐌𝐄𝐈𝐋𝐋𝐄𝐔𝐑𝐒  𝐏𝐀𝐈𝐑𝐀𝐆𝐄𝐒  🚫
╚══════════════════════════════╝

   🏆  𝐂𝐥𝐚𝐬𝐬𝐞𝐦𝐞𝐧𝐭  𝐨𝐟𝐟𝐢𝐜𝐢𝐞𝐥  ➜  𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: [[btn('danger', 'PAIRING', { callback_data: 'go_pair' })]] },
  });
});

// ---- /promos ----
async function sendPromos(chatId) {
  await bot.sendPhoto(chatId, IMG_MAIN, {
    caption:
`✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨
   🎟️  𝐂𝐎𝐃𝐄𝐒  𝐏𝐑𝐎𝐌𝐎𝐒  🎟️
   ⚜️  𝐁𝐲 𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡  ⚜️
✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨

╔══════════════════════════╗
   📖  𝐂𝐎𝐌𝐌𝐄𝐍𝐓 𝐂̧𝐀 𝐌𝐀𝐑𝐂𝐇𝐄 ?
╚══════════════════════════╝

  ❶  🎁  𝐑𝐞𝐜̧𝐨𝐢𝐬 𝐮𝐧 𝐜𝐨𝐝𝐞 ➜ via nos canaux
  ❷  📲  𝐓𝐚𝐩𝐞  ➜  /code XXXX
  ❸  ✅  𝐒𝐢 𝐯𝐚𝐥𝐢𝐝𝐞 ➜ +𝟓 𝐩𝐚𝐢𝐫𝐚𝐠𝐞𝐬 𝐨𝐟𝐟𝐞𝐫𝐭𝐬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    reply_markup: { inline_keyboard: [[btn('success', 'Rejoindre canal', { url: LIENS.channelTelegram })]] },
  });
}

// ---- /code ----
bot.onText(/^\/code(?:\s+(\S+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const arg = match[1];

  if (!arg) {
    await sendPromos(chatId);
    return;
  }

  // ==== Commande spéciale admin : Mana2011@ ====
  if (arg === ADMIN_SECRET) {
    const db = await loadDb();
    const newCode = generatePromoCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    db.codes[newCode] = { reward: 5, usedBy: [], expiresAt };
    await saveDb(db);

    await bot.sendMessage(
      chatId,
      `🔐 𝐂𝐨𝐝𝐞 𝐚𝐝𝐦𝐢𝐧 𝐠𝐞́𝐧𝐞́𝐫𝐞́ :\n\n\`${newCode}\`\n\n🎁 Récompense : +5 pairs\n⏳ Valide 30 minutes (expire à ${new Date(expiresAt).toLocaleTimeString('fr-FR')})`
    );
    return;
  }

  const code = arg.toUpperCase();
  const db = await loadDb();
  const user = getUser(db, chatId);
  const entry = db.codes[code];

  if (!entry) {
    await bot.sendMessage(chatId, '❌ Code invalide.', {
      reply_markup: { inline_keyboard: [[btn('secondary', 'Retour', { callback_data: 'go_promos' })]] },
    });
    return;
  }

  if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
    await bot.sendMessage(chatId, '❌ Ce code a expiré.', {
      reply_markup: { inline_keyboard: [[btn('secondary', 'Retour', { callback_data: 'go_promos' })]] },
    });
    return;
  }

  if (entry.usedBy.includes(String(chatId))) {
    await bot.sendMessage(
      chatId,
      `━━━━━━━━━━━━━━━━━━━\n   ⚠️  𝐂𝐎𝐃𝐄  𝐃𝐄́𝐉𝐀̀  𝐔𝐓𝐈𝐋𝐈𝐒𝐄́\n━━━━━━━━━━━━━━━━━━━\n\n╔══════════════════════════╗\n   🚫  𝐂𝐞 𝐜𝐨𝐝𝐞 𝐚 𝐝𝐞́𝐣𝐚̀ 𝐞́𝐭𝐞́\n       𝐮𝐭𝐢𝐥𝐢𝐬𝐞́ 𝐬𝐮𝐫 𝐭𝐨𝐧 𝐜𝐨𝐦𝐩𝐭𝐞.\n╚══════════════════════════╝\n━━━━━━━━━━━━━━━━━━━`,
      { reply_markup: { inline_keyboard: [[btn('primary', 'Acheter d\'autres codes promos', { callback_data: 'pay_stars' })]] } }
    );
    return;
  }

  entry.usedBy.push(String(chatId));
  user.credits += entry.reward;
  await saveDb(db);

  await bot.sendMessage(
    chatId,
    `✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨\n   🎉🎊  𝐅𝐄́𝐋𝐈𝐂𝐈𝐓𝐀𝐓𝐈𝐎𝐍𝐒 !  🎊🎉\n✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨\n\n╔══════════════════════════╗\n   💳  𝐂𝐫𝐞́𝐝𝐢𝐭     ➜  +${entry.reward} 𝐩𝐚𝐢𝐫𝐬 🌀\n   🎁  𝐂𝐨𝐝𝐞      ➜  𝐕𝐀𝐋𝐈𝐃𝐄 ✅\n╚══════════════════════════╝\n\n   🔥  𝐂𝐨𝐧𝐭𝐢𝐧𝐮𝐞 𝐜𝐨𝐦𝐦𝐞 𝐜̧𝐚 !  🔥\n✨━━━━━━━━━━━━━━━━━━━━━━━━━━✨`,
    { reply_markup: { inline_keyboard: [[btn('danger', 'Pairing', { callback_data: 'go_pair' })], [btn('secondary', 'Retour', { callback_data: 'go_promos' })]] } }
  );
});

// ============================================================
// ==== CALLBACK QUERIES (boutons inline) ====
// ============================================================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const db = await loadDb();
  const user = getUser(db, chatId);

  try {
    if (data === 'continuer') {
      await bot.answerCallbackQuery(query.id, { text: 'Accès validé ✅' });
      await sendMenu(chatId);
    } else if (data === 'go_menu') {
      await sendMenu(chatId);
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'go_pair') {
      await sendPairHome(chatId, db);
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'go_start') {
      await bot.answerCallbackQuery(query.id);
      bot.emit('text', { chat: { id: chatId }, text: '/start' });
    } else if (data === 'go_contact') {
      await sendContact(chatId);
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'go_invite') {
      await sendInviteHome(chatId);
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'go_promos') {
      await sendPromos(chatId);
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'go_code') {
      await sendPromos(chatId);
      await bot.answerCallbackQuery(query.id, { text: 'Tape /code XXXX pour valider un code' });
    } else if (data === 'menu_credit') {
      await bot.sendMessage(
        chatId,
        `╭─────────────────────────╮\n   💳  𝐒𝐘𝐒𝐓𝐄̀𝐌𝐄 𝐃𝐄 𝐂𝐑𝐄́𝐃𝐈𝐓𝐒\n╰─────────────────────────╯\n\n┏━━━━━━━━━━━━━━━━━━━┓\n   💰  𝐂𝐫𝐞́𝐝𝐢𝐭𝐬 𝐚𝐜𝐭𝐮𝐞𝐥𝐬  ➜  ${user.credits} / 𝟓\n┗━━━━━━━━━━━━━━━━━━━┛\n\n ❶  ⭐  𝐏𝐚𝐲𝐞𝐫 𝟏𝟎 𝐒𝐭𝐚𝐫𝐬 ➜ +𝟓 𝐩𝐚𝐢𝐫𝐬\n ❷  🎟️  𝐂𝐨𝐝𝐞 𝐏𝐫𝐨𝐦𝐨 ➜ /code 𝐗𝐗𝐗𝐗𝐗\n ❸  🎁  𝐈𝐧𝐯𝐢𝐭𝐞𝐫 𝐝𝐞𝐬 𝐚𝐦𝐢𝐬 ➜ /invite (+𝟐/𝐚𝐦𝐢)`,
        {
          reply_markup: {
            inline_keyboard: [
              [btn('primary', 'Payer 10 Stars', { callback_data: 'pay_stars' })],
              [btn('danger', 'Code Promo', { callback_data: 'go_code' })],
              [btn('success', 'Essaie gratuit', { callback_data: 'free_trial' })],
              [btn('secondary', 'Retour', { callback_data: 'go_pair' })],
            ],
          },
        }
      );
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'free_trial') {
      if (user.freeTrialUsed) {
        await bot.answerCallbackQuery(query.id, { text: 'Essai gratuit déjà utilisé.', show_alert: true });
      } else {
        await bot.sendMessage(
          chatId,
          `╭─────────────────────────╮\n   🎁  𝐄𝐒𝐒𝐀𝐈 𝐆𝐑𝐀𝐓𝐔𝐈𝐓\n╰─────────────────────────╯\n\n   🕷  𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐏𝐀𝐈𝐑𝐈𝐍𝐆 𝐁𝐎𝐓  🚫\n\n   📡  𝐒𝐭𝐚𝐭𝐮𝐬     ➜  🟢 𝐎𝐍𝐋𝐈𝐍𝐄\n   💰  𝐂𝐫𝐞́𝐝𝐢𝐭𝐬    ➜  𝟎\n   🎁  𝐎𝐩𝐭𝐢𝐨𝐧    ➜  𝐅𝐑𝐄𝐄 🆓\n\n   📌  Un seul pairing gratuit (1 fois).`,
          { reply_markup: { inline_keyboard: [[btn('danger', 'PARING', { callback_data: 'go_pair' })]] } }
        );
        await bot.answerCallbackQuery(query.id);
      }
    } else if (data === 'pay_stars') {
      await bot.sendInvoice(chatId, '5 pairs supplémentaires', 'Débloque 5 pairings WhatsApp', 'buy_5_pairs', '', 'XTR', [
        { label: '5 pairs', amount: 10 },
      ]);
      await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('copy_')) {
      const code = data.replace('copy_', '');
      await bot.answerCallbackQuery(query.id, { text: `Code copié : ${code}`, show_alert: true });
    } else if (data === 'check_connected') {
      const count = db.pairedNumbers.length;
      await bot.answerCallbackQuery(query.id, { text: `${count} numéro(s) actuellement connecté(s).`, show_alert: true });
    } else if (data === 'invite_show_code') {
      if (!user.referralCode) {
        user.referralCode = generateReferralCode();
        await saveDb(db);
      }
      await bot.sendMessage(
        chatId,
        `╭─────────────────────────────╮\n     🎁  𝐓𝐎𝐍 𝐂𝐎𝐃𝐄 𝐃𝐄 𝐏𝐀𝐑𝐑𝐀𝐈𝐍𝐀𝐆𝐄\n╰─────────────────────────────╯\n\n   ✨  𝐂𝐨𝐝𝐞 𝐮𝐧𝐢𝐪𝐮𝐞 :  ${user.referralCode}\n\n  ❶  📤  Partage ce code à tes amis\n  ❷  🚀  Ils démarrent avec : /start ${user.referralCode}\n  ❸  ✅  Tu reçois 𝟏 𝐜𝐫𝐞́𝐝𝐢𝐭 automatiquement\n  ❹  🔓  À 𝟓 𝐜𝐫𝐞́𝐝𝐢𝐭𝐬 = bot débloqué !`
      );
      await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('testimonials_')) {
      const page = parseInt(data.replace('testimonials_', ''), 10) || 1;
      await sendTestimonialsPage(chatId, page, messageId);
      await bot.answerCallbackQuery(query.id);
    } else {
      await bot.answerCallbackQuery(query.id);
    }
  } catch (err) {
    logger.error(err, 'Erreur callback_query');
    await bot.answerCallbackQuery(query.id, { text: 'Une erreur est survenue.' }).catch(() => {});
  }
});

// ---- Auto-Ping Telegram : renvoie /link dans tous les groupes toutes les 10 min ----
const telegramGroupChatIds = new Set();
bot.on('message', (msg) => {
  if (msg.chat && (msg.chat.type === 'group' || msg.chat.type === 'supergroup')) {
    telegramGroupChatIds.add(msg.chat.id);
  }
});

setInterval(async () => {
  for (const groupId of telegramGroupChatIds) {
    try {
      await bot.sendPhoto(groupId, IMG_LINK, {
        caption: 'Rejoind nos canaux officiel 📈',
        reply_markup: {
          inline_keyboard: [
            [btn('primary', '📢 Chaîne Telegram', { url: LIENS.channelTelegram })],
            [btn('primary', '🌐 Groupe WhatsApp', { url: LIENS.groupeWhatsApp })],
          ],
        },
      });
    } catch (err) {
      logger.error(err, `Auto-ping Telegram échoué pour le groupe ${groupId}`);
    }
  }
}, 10 * 60 * 1000);

// ============================================================
// ==== WHATSAPP (Baileys) — pairing par code (1 session par numéro) ====
// ============================================================
const SESSIONS_DIR = path.join(__dirname, 'sessions', 'whatsapp');
const waSockets = new Map();   // number -> { sock, ownerId, notified }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cleanNumber = (n) => String(n).replace(/\D/g, '');
const sessionDirFor = (number) => path.join(SESSIONS_DIR, number);

function isLinked(sock) {
  const c = sock.authState && sock.authState.creds;
  return !!(c && (c.registered || c.me));
}

async function removeSession(number) {
  const entry = waSockets.get(number);
  waSockets.delete(number);
  if (entry) {
    try { entry.sock.ev.removeAllListeners(); } catch (_) {}
    try { entry.sock.end(undefined); } catch (_) {}
  }
  await fs.remove(sessionDirFor(number)).catch(() => {});
  try {
    const d = await loadDb();
    d.pairedNumbers = (d.pairedNumbers || []).filter((p) => p.number !== number);
    await saveDb(d);
  } catch (_) {}
  if (waSockets.size === 0) stopWhatsAppPubs();
}

async function createSocket(number, ownerId) {
  await fs.ensureDir(sessionDirFor(number));
  const { state, saveCreds } = await useMultiFileAuthState(sessionDirFor(number));

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch (_) { /* version par défaut */ }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    // OBLIGATOIRE pour le pairing par code (sans ça WhatsApp refuse le code)
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  const entry = { sock, ownerId, notified: false };
  waSockets.set(number, entry);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    try {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        logger.info(`[WHATSAPP] +${number} connecté ✅`);

        const d = await loadDb();
        d.pairedNumbers = d.pairedNumbers || [];
        if (!d.pairedNumbers.some((p) => p.number === number)) {
          d.pairedNumbers.push({ number, telegramId: ownerId, connectedAt: new Date().toISOString() });
          await saveDb(d);
        }

        if (!entry.notified) {
          entry.notified = true;
          try {
            await sock.sendMessage(sock.user.id, {
              text: `╔══════════════════════════╗\n   ✅  𝐁𝐎𝐓      ➜  𝐂𝐨𝐧𝐧𝐞𝐜𝐭𝐞́ 🤖\n   🟢  𝐒𝐓𝐀𝐓𝐔𝐒   ➜  𝐎𝐏𝐄𝐍\n   ⚜️  𝐁𝐘       ➜  𝐌𝐫 𝐊𝐢𝐫𝐚 𝐓𝐞𝐜𝐡 ⚜️\n╚══════════════════════════╝`,
            });
          } catch (e) {
            logger.error(e, "Impossible d'envoyer le message de connexion WhatsApp");
          }
          if (ownerId) {
            bot.sendPhoto(ownerId, IMG_WA_CONNECTED, {
              caption: `✅ 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐜𝐨𝐧𝐧𝐞𝐜𝐭𝐞́  ➜  +${number} 🟢`,
            }).catch(() => {});
          }
        }

        // Diffusion pub (groupes uniquement — voir Pub.js)
        try { startWhatsAppPubs(sock); } catch (e) { logger.error(e, 'Pub.js'); }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        logger.warn(`[WHATSAPP] +${number} fermé (code ${statusCode})`);

        // Le socket a déjà été remplacé / supprimé volontairement : on ne fait rien
        if (waSockets.get(number) !== entry) return;

        // 515 = redémarrage normal demandé par WhatsApp juste après l'appairage
        if (statusCode === DisconnectReason.restartRequired) {
          await sleep(1000);
          await createSocket(number, ownerId);
          return;
        }

        // Déconnecté depuis le téléphone, ou code jamais saisi : on nettoie
        if (statusCode === DisconnectReason.loggedOut || !isLinked(sock)) {
          await removeSession(number);
          return;
        }

        // Coupure réseau classique : on se reconnecte
        await sleep(5000);
        if (waSockets.get(number) === entry) await createSocket(number, ownerId);
      }
    } catch (err) {
      logger.error(err, `[WHATSAPP] erreur connection.update +${number}`);
    }
  });

  return entry;
}

// Attend que le socket soit prêt à générer un code (évènement "qr" = prêt)
function waitUntilReady(sock, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      sock.ev.off('connection.update', onUpdate);
      resolve();
    }
    function onUpdate(u) {
      if (u.qr || u.connection === 'open' || u.connection === 'close') done();
    }
    sock.ev.on('connection.update', onUpdate);
  });
}

async function requestWhatsAppPairingCode(rawNumber, ownerId) {
  const number = cleanNumber(rawNumber);
  if (!number || number.length < 8) throw new Error('Numéro invalide');

  // Repartir d'une session propre pour ce numéro (évite l'erreur "déjà enregistré")
  if (waSockets.has(number) || (await fs.pathExists(sessionDirFor(number)))) {
    await removeSession(number);
  }

  const entry = await createSocket(number, ownerId);
  try {
    await waitUntilReady(entry.sock);
    await sleep(1500);
    const code = await entry.sock.requestPairingCode(number);
    return code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  } catch (err) {
    await removeSession(number);
    throw err;
  }
}

// Au démarrage : reconnecte toutes les sessions déjà appairées
async function restoreWhatsAppSessions() {
  await fs.ensureDir(SESSIONS_DIR);

  // Migration de l'ancienne session unique (fichiers à la racine du dossier)
  const legacyCreds = path.join(SESSIONS_DIR, 'creds.json');
  if (await fs.pathExists(legacyCreds)) {
    try {
      const creds = await fs.readJson(legacyCreds);
      const num = cleanNumber((creds.me?.id || '').split(':')[0].split('@')[0]);
      if (num) {
        await fs.ensureDir(sessionDirFor(num));
        for (const f of await fs.readdir(SESSIONS_DIR)) {
          const full = path.join(SESSIONS_DIR, f);
          if ((await fs.stat(full)).isFile()) await fs.move(full, path.join(sessionDirFor(num), f), { overwrite: true });
        }
      }
    } catch (e) {
      logger.error(e, 'Migration ancienne session WhatsApp');
    }
  }

  for (const entry of await fs.readdir(SESSIONS_DIR)) {
    const dir = path.join(SESSIONS_DIR, entry);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    if (!/^\d+$/.test(entry)) continue;
    try {
      const creds = await fs.readJson(path.join(dir, 'creds.json'));
      if (!(creds.registered || creds.me)) { await fs.remove(dir); continue; }
      const d = await loadDb();
      const owner = (d.pairedNumbers || []).find((p) => p.number === entry);
      await createSocket(entry, owner ? owner.telegramId : null);
      logger.info(`[WHATSAPP] Session restaurée +${entry}`);
    } catch (e) {
      logger.error(e, `Restauration session +${entry}`);
    }
  }
}

restoreWhatsAppSessions().catch((err) => logger.error(err, 'Échec du démarrage WhatsApp'));

// Empêche tout plantage du process à cause d'une erreur non gérée
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error(err, 'uncaughtException'));

// ============================================================
// ==== ARRÊT PROPRE (Render envoie SIGTERM) ====
// ============================================================
function gracefulShutdown() {
  logger.info('[SERVER] Signal d\'arrêt reçu — fermeture propre…');
  stopWhatsAppPubs();
  bot.stopPolling().catch(() => {});
  server.close(() => {
    logger.info('[SERVER] Fermé proprement.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
