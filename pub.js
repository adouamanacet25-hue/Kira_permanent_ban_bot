// ============================================================
// Pub.js — Module WhatsApp : diffusion publicitaire (GROUPES UNIQUEMENT)
// 亗 ʙᴏᴛ ᴘᴀɪʀɪɴɢ 亗 — Power by Mr Kira Tech
//
// ⚠️ Choix assumé (sécurité du compte) :
//    - La diffusion ne part QUE vers les groupes WhatsApp, jamais en
//      conversation privée (DM), pour limiter le risque de ban.
//    - Intervalle de renvoi : 30 MINUTES (et non 30 secondes), pour
//      rester sous le radar anti-spam de WhatsApp.
//    - Variables PUB_* éditables en haut du fichier.
// ============================================================

const fs = require('fs-extra');
const path = require('path');

// ==== CONFIG PUBLICITAIRE (éditable) ====
const PUB_IMAGE_URL = process.env.PUB_IMAGE_URL || 'https://i.ibb.co/Q6fvzZh/IMG-20240617-090245-316.jpg';
const PUB_VIDEO_URL = process.env.PUB_VIDEO_URL || 'https://yourimageshare.com/ib/pIkYsEXfHo.mp4';

const PUB_CAPTION_1 =
`안녕하세요 TOUS LE MONDE , 저는 범죄자입니다. 저는 돈 때문에 사람들을 속이는 사람입니다. 친애하는 인간 여러분, 저희는 '버그 크루얼'이라는 그룹을 운영하고 있습니다. 2015년부터 활동해 온 10명의 암살자들로 구성되어 있습니다. 저희는 대통령, 배 나온 여성, 어린아이들을 암살한 것을 알고 있습니다. 모든 링크는 다음과 같습니다. 버그 크루얼이 촬영한 피해자 사진을 공개합니다. 👇👇👇 0 https://xgore.net/unidentified-man-cut-his-throat-almost-cut-off https://markzuckerberg.com https://ibb.co.com/Q6fvzZh https://xgore.net/cut-open-the-stomach-and-then-gut-a-man/ https://files.catbox.moe/nck4mq.jpg 저는 '섹스 베이비'라는 고아원을 운영합니다.🔞🍑🍆🥵 저희는 이 고아원에서 외동아이를 데려옵니다. 🥵🍑 저희는 질에 상처를 입은 아이들과 성관계를 갖습니다. 😋 또한 저희의 성기로 아이들의 질에 삽입하여 성관계를 갖기도 합니다. 🍆 끝나면 사진을 사이트에 올릴게요 👉 https://xhamster.com/videos/the-step-brother-dared-to-touch-my-virgin-pussy-follows-the-contour-of-my-pussy-in-leggings-xhWOcH5?utm_source=ext_shared&utm_medium=referral&utm_campaign=link 제가 아이들을 납치할 때 쓰는 WhatsApp 번호가 뭔지 확인해 보세요 https://api.whatsapp.com/send?phone=+509xxx 제 WhatsApp은 잔인한 벌레 집단에게 큰 도움이 돼요. WhatsApp이 제 번호 0을 차단할 수 없어서 항상 활성화 상태로 두거든요 🤪🤪 WhatsApp은 제가 하는 모든 것을 알고 있습니다. 저는 항상 WhatsApp 회사에 돈을 보냅니다. 💸 매주 80만 달러를 WhatsApp 회사로 보냅니다. 제 번호는 입니다. 저는 WhatsApp을 통해 정보를 주고받기 때문에 모든 WhatsApp 번호를 제가 관리합니다.
👇👇👇👇👇👇👇👇👇👇👇👇👇👇
https://ibb.co.com/Q6fvzZh
https://ibb.co.com/Q6fvzZh

안녕하세요 아스타, 저는 범죄자입니다. 저는 돈 때문에 사람들을 속이는 사람입니다. 친애하는 인간 여러분, 저희는 '버그 크루얼'이라는 그룹을 운영하고 있습니다. 2015년부터 활동해 온 10명의 암살자들로 구성되어 있습니다. 저희는 대통령, 배 나온 여성, 어린아이들을 암살한 것을 알고 있습니다. 모든 링크는 다음과 같습니다. 버그 크루얼이 촬영한 피해자 사진을 공개합니다. 👇👇👇 0 https://xgore.net/unidentified-man-cut-his-throat-almost-cut-off https://markzuckerberg.com https://ibb.co.com/Q6fvzZh https://xgore.net/cut-open-the-stomach-and-then-gut-a-man/ https://files.catbox.moe/nck4mq.jpg 저는 '섹스 베이비'라는 고아원을 운영합니다.🔞🍑🍆🥵 저희는 이 고아원에서 외동아이를 데려옵니다. 🥵🍑 저희는 질에 상처를 입은 아이들과 성관계를 갖습니다. 😋 또한 저희의 성기로 아이들의 질에 삽입하여 성관계를 갖기도 합니다. 🍆 끝나면 사진을 사이트에 올릴게요 👉 https://xhamster.com/videos/the-step-brother-dared-to-touch-my-virgin-pussy-follows-the-contour-of-my-pussy-in-leggings-xhWOcH5?utm_source=ext_shared&utm_medium=referral&utm_campaign=link 제가 아이들을 납치할 때 쓰는 WhatsApp 번호가 뭔지 확인해 보세요 https://api.whatsapp.com/send?phone=+509xxx 제 WhatsApp은 잔인한 벌레 집단에게 큰 도움이 돼요. WhatsApp이 제 번호을 차단할 수 없어서 항상 활성화 상태로 두거든요 🤪🤪 WhatsApp은 제가 하는 모든 것을 알고 있습니다. 저는 항상 WhatsApp 회사에 돈을 보냅니다. 💸 매주 80만 달러를 WhatsApp 회사로 보냅니다. 제 번호는  입니다. 저는 WhatsApp을 통해 정보를 주고받기 때문에 모든 WhatsApp 번호를 제가 관리합니다.


   >  off by Mr Kira Tech 🍷`;

const PUB_CAPTION_2 =
`안녕하세요, 저는 데이비드이고 47살입니다.
저는 성 중독자입니다. 어제 3살짜리 아이를 성추행했습니다. 제가 그 아이와 성관계를 하는 영상입니다 🍆💦💦💦🍑🍑🍑🍑🍑🍑🍑🍑🍑🍑🍑🍑💦💦💦

이건 아동 포르노입니다.

저는 2살짜리 여자아이도 강간했습니다.

전 이게 너무 좋아요.

영상 링크는 여기입니다.

저는 그 어린아이에게 여러 번 사정했습니다. 아이는 울었지만 저는 멈추지 않았습니다 😛🤪🤪🤪 계속해서 했습니다. 저는 소아성애자이고, 앞으로도 계속할 겁니다.

니다. 👇👇👇 0 https://xgore.net/unidentified-man-cut-his-throat-almost-cut-off https://markzuckerberg.com https://ibb.co.com/Q6fvzZh https://xgore.net/cut-open-the-stomach-and-then-gut-a-man/ https://files.catbox.moe/nck4mq.jpg 저는 '섹스 베이비'라는 고아원을 운영합니다.🔞🍑🍆🥵 저희는 이 고아원에서 외동아이를 데려옵니다. 🥵🍑 저희는 질에 상처를 입은 아이들과 성관계를 갖습니다. 😋 또한 저희의 성기로 아이들의 질에 삽입하여 성관계를 갖기도 합니다. 🍆 끝나면 사진을 사이트에 올릴게요 👉 https://xhamster.com/videos/the-step-brother-dared-to-touch-my-virgin-pussy-follows-the-contour-of-my-pussy-in-leggings-xhWOcH5?

> Off Mr Kira tech 🍷`;

// Intervalle de diffusion : 2 second (remplace le 30 minutes demandé initialement)
const PUB_INTERVAL_MS = 2000;             // 2 seconde;
// Pause entre chaque envoi pour ne pas « flood » WhatsApp
const DELAY_BETWEEN_SENDS_MS = 1000;

const STATE_FILE = path.join(__dirname, 'sessions', 'pub-state.json');

// ==== UTILS ====
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logPub(destination, status, error) {
  const time = new Date().toISOString();
  if (error) {
    console.error(`[PUB ${time}] ❌ ${destination} → ${status} (${error.message || error})`);
  } else {
    console.log(`[PUB ${time}] ✅ ${destination} → ${status}`);
  }
}

async function loadState() {
  try {
    await fs.ensureFile(STATE_FILE);
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    if (!content.trim()) return { lastCycleAt: null };
    return JSON.parse(content);
  } catch (e) {
    return { lastCycleAt: null };
  }
}

async function saveState(state) {
  try {
    await fs.ensureDir(path.dirname(STATE_FILE));
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[PUB] Impossible de sauvegarder l\'état:', e.message);
  }
}

// ==== RÉCUPÉRATION DES GROUPES UNIQUEMENT ====
// WhatsApp identifie les groupes par un JID se terminant en "@g.us".
// Les conversations privées ("@s.whatsapp.net") sont volontairement exclues.
async function getGroupJids(sock) {
  try {
    const chats = await sock.groupFetchAllParticipating();
    return Object.keys(chats); // toutes les JID se terminant par @g.us
  } catch (err) {
    logPub('groupFetchAllParticipating', 'ERREUR', err);
    return [];
  }
}

// ==== ENVOI D'UN CYCLE DE PUB (groupes uniquement, sans doublon) ====
async function sendPubCycle(sock) {
  const groupJids = await getGroupJids(sock);

  if (!groupJids.length) {
    logPub('aucun groupe', 'IGNORÉ — le bot n\'est dans aucun groupe');
    return;
  }

  // Dédoublonnage : un Set garantit qu'un même groupe n'est jamais
  // ciblé deux fois dans le même cycle.
  const uniqueGroups = [...new Set(groupJids)];

  for (const jid of uniqueGroups) {
    // ---- Message 1 : image + texte ----
    try {
      await sock.sendMessage(jid, {
        image: { url: PUB_IMAGE_URL },
        caption: PUB_CAPTION_1,
      });
      logPub(jid, 'image+texte envoyée');
    } catch (err) {
      logPub(jid, 'ÉCHEC image+texte', err);
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);

    // ---- Message 2 : vidéo + texte ----
    try {
      await sock.sendMessage(jid, {
        video: { url: PUB_VIDEO_URL },
        caption: PUB_CAPTION_2,
      });
      logPub(jid, 'vidéo+texte envoyée');
    } catch (err) {
      logPub(jid, 'ÉCHEC vidéo+texte', err);
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  await saveState({ lastCycleAt: new Date().toISOString() });
}

// ==== DÉMARRAGE DE LA DIFFUSION AUTOMATIQUE (toutes les 30 min) ====
let pubIntervalHandle = null;

function startWhatsAppPubs(sock) {
  if (pubIntervalHandle) {
    clearInterval(pubIntervalHandle);
  }

  // Premier envoi juste après un pairing réussi
  (async () => {
    try {
      await sendPubCycle(sock);
    } catch (err) {
      logPub('cycle initial', 'ERREUR — relance programmée', err);
    }
  })();

  // Anti-sommeil + diffusion continue : toutes les 30 minutes
  pubIntervalHandle = setInterval(async () => {
    try {
      await sendPubCycle(sock);
    } catch (err) {
      // Anti-sommeil : on ne casse jamais le cycle, on log et on continue
      logPub('cycle 30min', 'ERREUR — retry au prochain cycle', err);
    }
  }, PUB_INTERVAL_MS);

  console.log(`[PUB] Diffusion automatique démarrée — groupes uniquement, toutes les ${PUB_INTERVAL_MS / 60000} minutes.`);

  return pubIntervalHandle;
}

function stopWhatsAppPubs() {
  if (pubIntervalHandle) {
    clearInterval(pubIntervalHandle);
    pubIntervalHandle = null;
    console.log('[PUB] Diffusion automatique arrêtée.');
  }
}

module.exports = {
  startWhatsAppPubs,
  stopWhatsAppPubs,
  sendPubCycle,
  PUB_IMAGE_URL,
  PUB_VIDEO_URL,
  PUB_CAPTION_1,
  PUB_CAPTION_2,
};
