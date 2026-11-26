// Paksa semua fetch (termasuk undici internal node & baileys) pakai koneksi IPv4 saja.
// Sandbox/VPS tertentu: IPv6 ke CDN WhatsApp timeout, IPv4 jalan.
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(
  new Agent({
    connect: {
      autoSelectFamily: false, // jangan happy-eyeballs
      order: "ipv4first",
      timeout: 20000,
    },
  })
);
