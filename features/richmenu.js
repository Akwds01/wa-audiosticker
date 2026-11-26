// ═══════════════════════════════════════════
//  FITUR: RICHMENU — menu HTML interaktif di dalam chat WA
//  Menggunakan permukaan render richResponseMessage (GenAI HtmlPrimitive)
//  Adaptasi dari rich-engine Elysia (arthazyy)
//  Fallback otomatis ke pesan teks jika WA user tidak mendukung
// ═══════════════════════════════════════════

const DEFAULT_BOT_JID = "867051314767696@bot";
const CAPABILITIES = [34, 58, 29, 1, 67, 60, 55, 8];

const hex = (n) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const randomResponseId = () =>
  `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;

export function buildRichHtmlPayload(html, title = "XCPT Menu") {
  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        capabilityMetadata: { capabilities: CAPABILITIES },
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: title }],
          unifiedResponse: {
            data: Buffer.from(
              JSON.stringify({
                response_id: randomResponseId(),
                sections: [
                  {
                    view_model: {
                      primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: html,
                        trusted_sources: [],
                      },
                      __typename: "GenAISingleLayoutViewModel",
                    },
                  },
                ],
              })
            ).toString("base64"),
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID },
            forwardOrigin: 4,
          },
        },
      },
    },
  };
}

export async function sendRichMenu(sock, jid, html, title) {
  await sock.relayMessage(jid, buildRichHtmlPayload(html, title), {});
}

// ── HTML menu (gaya kartu dark, branding XCPT) ──
export function buildMenuHtml(stats = {}) {
  const cmd = (icon, name, desc) => `
    <div class="cmd">
      <div class="cmd-ic">${icon}</div>
      <div class="cmd-tx">
        <div class="cmd-n">${name}</div>
        <div class="cmd-d">${desc}</div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#120c1c;--card:#1d142c;--card2:#281c3d;--ink:#fdf4ff;--soft:#d4bfe8;--line:#3f2b5c;--acc:#f472b6;--acc2:#c084fc;--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);}
.stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
.app{width:100%;max-width:640px;border-radius:14px;overflow:hidden;position:relative;
  background:radial-gradient(circle at 85% 0%,rgba(244,114,182,.22) 0%,transparent 48%),
             radial-gradient(circle at 10% 100%,rgba(192,132,252,.18) 0%,transparent 52%),
             linear-gradient(180deg,#251738 0%,#171024 40%,var(--bg) 100%);
  border:1px solid rgba(244,114,182,.28);
  box-shadow:0 18px 44px rgba(8,4,16,.68), inset 0 1px 0 rgba(255,255,255,.08);
  padding:14px 12px 16px;}
.top{display:flex;align-items:center;gap:10px;margin-bottom:4px;}
.logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f472b6 0%,#a855f7 100%);
  color:#fff;flex:none;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;
  box-shadow:0 4px 14px rgba(244,114,182,.35);}
.title{font-size:15px;font-weight:900;letter-spacing:.3px;color:#fff;}
.sub{font-size:10.5px;color:var(--soft);margin-top:1px;}
.badge{margin-left:auto;background:rgba(244,114,182,.15);border:1px solid rgba(244,114,182,.4);color:var(--acc);
  border-radius:20px;padding:4px 10px;font-size:10px;font-weight:800;letter-spacing:1px;}
.sep{height:1px;background:linear-gradient(90deg,transparent,rgba(244,114,182,.4),transparent);margin:12px 0;}
.sect{font-size:11px;font-weight:800;color:var(--acc2);letter-spacing:1.5px;margin:10px 2px 8px;}
.cmd{display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);
  border-radius:12px;padding:10px 12px;margin-bottom:8px;}
.cmd-ic{width:34px;height:34px;border-radius:9px;background:var(--card2);display:flex;align-items:center;
  justify-content:center;font-size:16px;flex:none;}
.cmd-n{font-size:13.5px;font-weight:800;color:#fff;font-family:monospace;background:rgba(244,114,182,.12);
  border-radius:6px;padding:2px 7px;display:inline-block;}
.cmd-d{font-size:11px;color:var(--soft);margin-top:4px;line-height:1.45;}
.steps{display:flex;flex-direction:column;gap:6px;}
.step{display:flex;gap:10px;align-items:flex-start;}
.sn{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#f472b6,#a855f7);color:#fff;
  font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px;}
.st{font-size:12px;color:var(--soft);line-height:1.5;}
.st b{color:#fff;}
.foot{text-align:center;font-size:10px;color:var(--soft);margin-top:12px;letter-spacing:.5px;}
</style></head>
<body><div class="stage"><div class="app">
  <div class="top">
    <div class="logo">XCPT</div>
    <div>
      <div class="title">Bot Audiosticker</div>
      <div class="sub">Stiker bersuara native WA 🔊</div>
    </div>
    <div class="badge">v2</div>
  </div>

  <div class="sep"></div>

  <div class="sect">🎨 CARA PAKAI</div>
  <div class="steps">
    <div class="step"><div class="sn">1</div><div class="st">Ketik <b>!as</b> + kirim/reply <b>audio</b> (mp3/ogg/m4a/VN) 🎵</div></div>
    <div class="step"><div class="sn">2</div><div class="st">Kirim/reply <b>gambar, GIF, stiker, atau video</b> 🖼️</div></div>
    <div class="step"><div class="sn">3</div><div class="st">Audio sticker <b>native</b> langsung terkirim — ikon speaker + waveform! 🔊</div></div>
  </div>

  <div class="sep"></div>

  <div class="sect">⚡ PERINTAH</div>
  ${cmd("🎵", "!as", "Mulai sesi audiosticker (bisa + reply media). Urutan bebas: audio dulu atau gambar dulu.")}
  ${cmd("🎬", "video beraudio", "Reply video yang ada suaranya pakai !as → langsung jadi audio sticker animasi, tanpa audio terpisah!")}
  ${cmd("🖼️", "stiker lama", "Reply stiker yang sudah ada pakai !as (setelah audio disimpan) → langsung diberi suara")}
  ${cmd("📖", "!menu", "Tampilkan kartu menu ini")}

  <div class="sep"></div>

  <div class="sect">✨ FITUR</div>
  ${cmd("🔊", "Native Audio Sticker", "Stiker asli WA bersuara — bukan stiker biasa + audio terpisah. Tanpa API eksternal.")}
  ${cmd("🎞️", "Video → Animasi", "Video otomatis dikonversi jadi stiker animasi (fps 10, 512×512)")}
  ${cmd("🏷️", "Pack: XCPT", "Semua stiker di-watermark pack & author XCPT (EXIF)")}

  <div class="foot">— XCPT AUDIOSTICKER BOT —</div>
</div></div></body></html>`;
}
