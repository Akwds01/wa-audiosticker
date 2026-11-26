// ═══════════════════════════════════════════
//  FITUR: AUDIO STICKER NATIVE (tanpa API)
//  Stiker asli bersuara — ikon speaker + waveform di WA
//  Diadaptasi dari plugin elysia (arthazy)
// ═══════════════════════════════════════════
import {
  proto,
  prepareWAMessageMedia,
  downloadContentFromMessage,
} from "@whiskeysockets/baileys";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import webpmux from "node-webpmux";
import config from "../config.js";

const execFileAsync = promisify(execFile);

// Sesi audio per user: key "chat|sender" -> { audioBuf }
export const audioSession = new Map();

// ── EXIF webp (nama pack & author) ──
async function addExif(webpBuf) {
  try {
    const img = new webpmux.Image();
    await img.load(webpBuf);
    const json = {
      "sticker-pack-id": randomBytes(32).toString("hex"),
      "sticker-pack-name": config.sticker.pack,
      "sticker-pack-publisher": config.sticker.author,
      emojis: [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;
    return await img.save(null);
  } catch {
    return webpBuf; // gagal exif → teruskan tanpa exif
  }
}

// ── Patch proto WA agar audioStickerMessage tidak dibuang saat relay ──
function patchMessageProto(M) {
  if (!M || M.__audioStickerPatchedV4) return;

  if (M.StickerMessage && typeof M.StickerMessage.encode === "function") {
    const prevStickerEncode = M.StickerMessage.encode;
    M.StickerMessage.encode = function (message, writer) {
      const audio = message?.audioMessage;
      if (audio && Object.prototype.hasOwnProperty.call(message, "audioMessage")) {
        delete message.audioMessage;
      }
      const w = prevStickerEncode.call(this, message, writer);
      if (audio && M.AudioMessage) {
        message.audioMessage = audio;
        M.AudioMessage.encode(audio, w.uint32(210).fork()).ldelim();
      }
      return w;
    };

    if (typeof M.StickerMessage.fromObject === "function") {
      const prevStickerFromObj = M.StickerMessage.fromObject;
      M.StickerMessage.fromObject = function (object) {
        const msg = prevStickerFromObj.call(this, object);
        if (object?.audioMessage) {
          msg.audioMessage = M.AudioMessage?.fromObject
            ? M.AudioMessage.fromObject(object.audioMessage)
            : object.audioMessage;
        }
        return msg;
      };
    }
  }

  const prevMsgEncode = M.encode;
  M.encode = function (message, writer) {
    const asm = message?.audioStickerMessage;
    if (asm) {
      if (Object.prototype.hasOwnProperty.call(message, "stickerMessage")) {
        delete message.stickerMessage;
      }
      if (Object.prototype.hasOwnProperty.call(message, "audioStickerMessage")) {
        delete message.audioStickerMessage;
      }
    }
    const w = prevMsgEncode.call(this, message, writer);
    if (asm && M.FutureProofMessage) {
      message.audioStickerMessage = asm;
      M.FutureProofMessage.encode(asm, w.uint32(1074).fork()).ldelim();
    }
    return w;
  };

  if (typeof M.fromObject === "function") {
    const prevMsgFromObj = M.fromObject;
    M.fromObject = function (object) {
      const msg = prevMsgFromObj.call(this, object);
      if (object?.audioStickerMessage) {
        const rawInner =
          object.audioStickerMessage.message || object.audioStickerMessage;
        const inner = M.fromObject(rawInner);
        if (
          inner?.stickerMessage &&
          rawInner?.stickerMessage?.audioMessage &&
          !inner.stickerMessage.audioMessage
        ) {
          inner.stickerMessage.audioMessage = M.AudioMessage?.fromObject
            ? M.AudioMessage.fromObject(rawInner.stickerMessage.audioMessage)
            : rawInner.stickerMessage.audioMessage;
        }
        msg.audioStickerMessage = M.FutureProofMessage?.fromObject
          ? M.FutureProofMessage.fromObject({ message: inner })
          : { message: inner };
        delete msg.stickerMessage;
      }
      return msg;
    };
  }

  M.__audioStickerPatchedV4 = true;
}

export function ensureAllProtosPatched(extraCtor = null) {
  if (proto?.Message) patchMessageProto(proto.Message);
  if (extraCtor) patchMessageProto(extraCtor);
}

function generateWaveform(seedBuf, length = 64) {
  const wf = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    const b =
      seedBuf && seedBuf.length ? seedBuf[(i * 19 + 7) % seedBuf.length] : i * 11;
    wf[i] = 18 + (b % 76);
  }
  return wf;
}

function parseFfmpegDuration(stderrText) {
  const matches = [
    ...String(stderrText || "").matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g),
  ];
  if (!matches.length) return 0;
  const last = matches[matches.length - 1];
  const sec = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  return Number.isFinite(sec) ? sec : 0;
}

async function convertAudioToOggOpus(buffer) {
  const tmpId = randomBytes(6).toString("hex");
  const inPath = path.join(os.tmpdir(), `as_in_${tmpId}.bin`);
  const outPath = path.join(os.tmpdir(), `as_out_${tmpId}.ogg`);
  try {
    await fs.writeFile(inPath, buffer);
    const { stderr } = await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-vn",
      "-map", "0:a:0",
      "-t", String(config.maxAudioDuration),
      "-af", "aresample=48000:async=1:first_pts=0",
      "-c:a", "libopus",
      "-b:a", "48k",
      "-vbr", "on",
      "-compression_level", "10",
      "-ac", "1",
      "-ar", "48000",
      "-application", "audio",
      "-avoid_negative_ts", "make_zero",
      "-f", "ogg",
      outPath,
    ]);
    const oggBuffer = await fs.readFile(outPath);
    const seconds = Math.max(
      1,
      Math.min(config.maxAudioDuration, Math.round(parseFfmpegDuration(stderr) || 3))
    );
    return { oggBuffer, seconds };
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

function isWebpAnimated(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return false;
  if (buf.toString("ascii", 12, 16) === "VP8X" && (buf[20] & 0x02) !== 0)
    return true;
  return buf.includes(Buffer.from("ANIM"));
}

// deteksi video (mp4/mov — magic bytes "ftyp")
function isVideoBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length > 12 && buf.toString("ascii", 4, 8) === "ftyp";
}

// video → webp animasi 512x512 (fps 10, transparan, loop)
async function videoToAnimatedWebp(videoBuf) {
  const tmpId = randomBytes(6).toString("hex");
  const inPath = path.join(os.tmpdir(), `as_vid_${tmpId}.mp4`);
  const outPath = path.join(os.tmpdir(), `as_vid_${tmpId}.webp`);
  try {
    await fs.writeFile(inPath, videoBuf);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-vf", "fps=10,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1",
      "-c:v", "libwebp",
      "-lossless", "0",
      "-compression_level", "6",
      "-q:v", "50",
      "-loop", "0",
      "-preset", "picture",
      "-an",
      "-vsync", "0",
      outPath,
    ]);
    const out = await fs.readFile(outPath);
    if (out.length < 100) throw new Error("hasil kosong");
    return out;
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

// video punya track audio?
export async function videoHasAudio(videoBuf) {
  const tmpId = randomBytes(6).toString("hex");
  const p = path.join(os.tmpdir(), `as_probe_${tmpId}.mp4`);
  try {
    await fs.writeFile(p, videoBuf);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", p]);
    return /audio/.test(stdout);
  } catch {
    return false;
  } finally {
    await fs.unlink(p).catch(() => {});
  }
}

// ekstrak track audio dari video → buffer audio
export async function extractAudioFromVideo(videoBuf) {
  const tmpId = randomBytes(6).toString("hex");
  const inPath = path.join(os.tmpdir(), `as_ex_${tmpId}.mp4`);
  const outPath = path.join(os.tmpdir(), `as_ex_${tmpId}.m4a`);
  try {
    await fs.writeFile(inPath, videoBuf);
    await execFileAsync("ffmpeg", ["-y", "-i", inPath, "-vn", "-map", "0:a:0", "-t", String(config.maxAudioDuration), outPath]);
    return await fs.readFile(outPath);
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

// Download media dari pesan WA (image/sticker/audio/video/document)
export async function downloadQuotedBuffer(sock, msg) {
  const rawMsg = msg.message || {};
  const mediaObj =
    rawMsg.audioMessage ||
    rawMsg.stickerMessage ||
    rawMsg.imageMessage ||
    rawMsg.documentMessage ||
    rawMsg.videoMessage;
  if (!mediaObj) return null;
  const dlType = rawMsg.audioMessage
    ? "audio"
    : rawMsg.stickerMessage
      ? "sticker"
      : rawMsg.imageMessage
        ? "image"
        : rawMsg.documentMessage
          ? "document"
          : "video";
  const stream = await downloadContentFromMessage(mediaObj, dlType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Kirim audio sticker NATIVE
export async function sendNativeAudioSticker(sock, jid, msg, audioBuf, rawImg) {
  const react = (e) =>
    sock.sendMessage(jid, { react: { text: e, key: msg.key } }).catch(() => {});

  await react("⏳");
  try {
    // video → webp animasi via ffmpeg; gambar → webp 512x512 (stiker/webp asli hanya exif)
    const isWebp =
      rawImg.length > 12 && rawImg.toString("ascii", 0, 4) === "RIFF";
    let stickerBuf = rawImg;
    if (isVideoBuffer(rawImg)) {
      stickerBuf = await videoToAnimatedWebp(rawImg);
    } else if (!isWebp) {
      stickerBuf = await sharp(rawImg)
        .rotate()
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 82 })
        .toBuffer();
    }
    stickerBuf = await addExif(stickerBuf);

    // audio → ogg opus 48kHz mono
    const conv = await convertAudioToOggOpus(audioBuf);
    const oggBuf = conv.oggBuffer;
    const duration = conv.seconds;

    const uploadOpts = {
      upload: sock.waUploadToServer,
      logger: sock.logger,
    };

    const [audioMedia, stickerMedia] = await Promise.all([
      prepareWAMessageMedia(
        { audio: oggBuf, mimetype: "audio/ogg; codecs=opus", ptt: true },
        uploadOpts
      ),
      prepareWAMessageMedia({ sticker: stickerBuf }, uploadOpts),
    ]);

    if (!stickerMedia?.stickerMessage) {
      throw new Error("Gagal menyiapkan media stiker");
    }

    ensureAllProtosPatched(stickerMedia.constructor);

    const animated = isWebpAnimated(stickerBuf);
    const innerStickerMsg = {
      ...stickerMedia.stickerMessage,
      isAnimated: animated,
      audioMessage: {
        ...audioMedia.audioMessage,
        mimetype: "audio/ogg; codecs=opus",
        seconds: duration,
        ptt: true,
        waveform: generateWaveform(oggBuf),
      },
    };

    await sock.relayMessage(
      jid,
      {
        audioStickerMessage: {
          message: {
            stickerMessage: innerStickerMsg,
          },
        },
        messageContextInfo: {
          messageSecret: randomBytes(32),
        },
      },
      {}
    );

    await react("✅");
  } catch (e) {
    await react("❌");
    throw e;
  }
}
