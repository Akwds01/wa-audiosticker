// ═══════════════════════════════════════════
//  MENU UTAMA BOT AUDIOSTICKER
//  Koneksi WA, pairing, dan routing pesan
//  Fitur ada di folder features/, config di config.js
// ═══════════════════════════════════════════
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // sandbox: IPv6 WA CDN timeout, IPv4 jalan
import "./lib/net-fix.js"; // matikan happy-eyeballs undici, paksa IPv4
import config from "./config.js";
import {
  sendNativeAudioSticker,
  downloadQuotedBuffer,
  audioSession,
} from "./features/audiosticker-native.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = pino({ level: "silent" });

// per-chat pending state: { mediaBuf, audioBuf, mediaUrl, audioUrl }
const pending = new Map();

function classify(mtype) {
  const t = Object.keys(mtype || {})[0] || "";
  if (/^imageMessage$|^stickerMessage$|^videoMessage$/.test(t)) return "media";
  if (/^audioMessage$/.test(t)) return "audio"; // mp3/ogg/m4a/voice note
  if (/^documentMessage$/.test(t)) {
    const name = (mtype.documentMessage?.fileName || "").toLowerCase();
    if (/\.(mp3|ogg|m4a|wav|opus)$/.test(name)) return "audio";
    if (/\.(jpg|jpeg|png|webp|gif|mp4)$/.test(name)) return "media";
    return "unknown";
  }
  return "unknown";
}

async function getMediaBuffer(sock, msg, mtype) {
  const node = msg.message[Object.keys(msg.message)[0]];
  if (!node?.mediaKey) return null;
  const buf = await downloadQuotedBuffer(sock, msg).catch(() => null);
  if (buf && buf.length > 100) return buf;
  const buf2 = await downloadMediaMessage(msg, "buffer", {}, {
    reuploadRequest: sock.updateMediaMessage,
  });
  return buf2 && buf2.length > 100 ? buf2 : null;
}

async function sendText(sock, jid, msg, text) {
  for (let i = 1; i <= 3; i++) {
    try {
      await Promise.race([
        sock.sendMessage(jid, { text, quoted: msg }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 20000)),
      ]);
      console.log("REPLY OK ->", jid);
      return;
    } catch (e) {
      console.error(`REPLY percobaan ${i} GAGAL ->`, jid, e.message);
      if (i === 3) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

const HELP = `🎨 *Bot Audiosticker — XCPT*

*Cara pakai:*
1. Ketik \`!as\` + kirim/reply audio (mp3/ogg/VN) 🎵
2. Kirim/reply gambar / GIF / stiker / video 🖼️
→ Audio sticker NATIVE dibikin — ikon speaker di WA! 🔊

Bisa dibalik (gambar dulu baru audio), dan tanpa \`!as\` juga bisa — media langsung dikenali.
Stiker yang sudah ada bisa diberi suara: reply stikernya pakai \`!as\` setelah audio disimpan.

Perintah: \`!menu\` bantuan`;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "auth"));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    auth: state,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  const botNumber = (process.argv[2] || config.botNumber);
  if (!sock.authState.creds.registered && botNumber) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(botNumber.replace(/\D/g, ""), config.pairingCode);
        console.log(`PAIRING CODE: ${code.slice(0, 4)}-${code.slice(4)}`);
      } catch (e) {
        console.error("Gagal minta pairing code:", e.message);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        fs.rmSync(path.join(__dirname, "auth"), { recursive: true, force: true });
        console.log("Logged out — auth dihapus, jalankan ulang untuk pairing baru.");
        process.exit(0);
      }
      console.log("Terputus, reconnect...", code);
      start();
    } else if (connection === "open") {
      console.log("terhubung");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.participantAlt || jid;
    const sessionKey = jid + "|" + sender;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
    const mtype = msg.message;
    console.log("PESAN MASUK:", jid, "keys:", Object.keys(mtype || {}), "text:", text.slice(0, 50));
    const isCmd = /^[.!]?\s*(as|astick|audiosticker|stikeraudio|menu|help)\b/i.test(text);

    try {
      if (isCmd) {
        await handleCommand(sock, jid, msg, text, mtype, sessionKey);
        return;
      }

      // Media tanpa teks → lanjutkan pending flow
      const cls = classify(mtype);
      if ((cls === "media" || cls === "audio") && !text) {
        let p = pending.get(sessionKey);
        if (!p) {
          // otomatis mulai sesi
          p = {};
          pending.set(sessionKey, p);
        }
        const buf = await getMediaBuffer(sock, msg, mtype);
        if (!buf) throw new Error("Gagal ambil media dari pesan");
        if (cls === "audio") {
          p.audioBuf = buf;
          await sendText(sock, jid, msg, "🎵 Audio diterima ✅");
        } else {
          p.mediaBuf = buf;
          await sendText(sock, jid, msg, "🖼️ Media diterima ✅");
        }
        if (p.mediaBuf && p.audioBuf) {
          pending.delete(sessionKey);
          await sendNativeAudioSticker(sock, jid, msg, p.audioBuf, p.mediaBuf);
        } else {
          await sendText(sock, jid, msg,
            p.mediaBuf ? "Sekarang kirim audionya (mp3/ogg/m4a/VN) 👉" : "Sekarang kirim gambar/gif/stikernya 👉");
        }
      }
    } catch (e) {
      console.error(e);
      await sendText(sock, jid, msg, "❌ Error: " + e.message).catch(() => {});
    }
  });
}

async function handleCommand(sock, jid, msg, text, mtype, sessionKey) {
  if (/^[.!]?\s*(menu|help)\b/i.test(text)) {
    await sendText(sock, jid, msg, HELP);
    return;
  }

  const body = text.replace(/^[.!]?\s*(?:as|astick|audiosticker|stikeraudio)\b\s*/i, "").trim();
  const cls = classify(mtype);

  // !as + reply ke media (step flow native)
  if (cls === "media" || cls === "audio") {
    const buf = await getMediaBuffer(sock, msg, mtype);
    if (!buf) throw new Error("Gagal ambil media dari pesan");

    if (cls === "audio") {
      // step 1: simpan audio
      audioSession.set(sessionKey, { audioBuf: buf });
      await sendText(sock, jid, msg,
        "🎵 Audio disimpan ✅\n\n*Step 2:* kirim / reply gambar, stiker, atau GIF-nya 👉");
      return;
    }

    // media + cek audio tersimpan?
    if (audioSession.has(sessionKey)) {
      const { audioBuf } = audioSession.get(sessionKey);
      audioSession.delete(sessionKey);
      await sendNativeAudioSticker(sock, jid, msg, audioBuf, buf);
      return;
    }

    // belum ada audio → simpan sebagai pending, tunggu audio
    pending.set(sessionKey, { mediaBuf: buf });
    await sendText(sock, jid, msg,
      "🖼️ Media diterima ✅\nSekarang kirim audionya (mp3/ogg/m4a/VN) 👉");
    return;
  }

  // !as kosong → mulai sesi, tunggu media berikutnya
  if (!pending.has(sessionKey)) pending.set(sessionKey, {});
  await sendText(sock, jid, msg,
    "🎨 Siap! Sekarang kirim *audio* (mp3/ogg/m4a/VN) 🎵 atau *gambar/GIF/stiker/video* 🖼️\n\n(bot akan nunggu keduanya, lalu langsung gabung jadi audio sticker 🔊)");
}

start();
