// ═══════════════════════════════════════════
//  KONFIGURASI BOT AUDIOSTICKER
//  Edit semua pengaturan di file ini saja
// ═══════════════════════════════════════════

export default {
  // Nomor WA bot (untuk pairing code) — juga bisa lewat argumen: node bot.js 628xx
  botNumber: process.env.BOT_NUMBER || "",

  // Kode pairing custom (max 8 karakter, alfanumerik, ditampilkan XXXX-XXXX)
  pairingCode: "JERE0001",

  // Metadata stiker (EXIF) — tampil di detail stiker WA
  sticker: {
    pack: "XCPT",
    author: "XCPT",
  },

  // Durasi maksimal audio di audio sticker (detik, max 25)
  maxAudioDuration: 25,

  // Prefix perintah yang dikenali: "!as" / ".as" / "as"
  prefixes: [".", "!", ""],

  // Perintah fitur audiosticker
  commands: ["as", "astick", "audiosticker", "stikeraudio"],
};
