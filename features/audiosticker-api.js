// ═══════════════════════════════════════════
//  FITUR: AUDIO STICKER VIA API JERE-API
//  Mode URL: !as <urlGambar> | <urlAudio>
// ═══════════════════════════════════════════
import config from "../config.js";

export async function sendApiAudioSticker(sock, jid, msg, mediaUrl, audioUrl, sendText) {
  const react = (e) => sock.sendMessage(jid, { react: { text: e, key: msg.key } }).catch(() => {});
  await react("⏳");
  try {
    const url =
      `${config.jereApi.base}?apikey=${config.jereApi.apiKey}` +
      `&media=${encodeURIComponent(mediaUrl)}` +
      (audioUrl ? `&audio=${encodeURIComponent(audioUrl)}` : "") +
      `&pack=${encodeURIComponent(config.sticker.pack)}` +
      `&author=${encodeURIComponent(config.sticker.author)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
    const json = await res.json();
    if (!json.status) {
      await react("❌");
      await sendText(sock, jid, msg, "❌ Gagal: " + (json.error || "unknown"));
      return;
    }
    const stickerBuf = Buffer.from(json.result.sticker.base64, "base64");
    await Promise.race([
      sock.sendMessage(jid, { sticker: stickerBuf, quoted: msg }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout kirim stiker")), 30000)),
    ]);
    await react("✅");
  } catch (e) {
    await react("❌");
    await sendText(sock, jid, msg, "❌ Error: " + e.message);
    throw e;
  }
}
