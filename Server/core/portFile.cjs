"use strict";

const fs = require("fs");
const path = require("path");
const net = require("net");

const PORT_FILE = path.join(process.cwd(), ".bossmind-port");

/**
 * Check if a port is free for the same bind host your server uses.
 * Windows note: a port can look "free" on 127.0.0.1 while still blocked on 0.0.0.0
 * by another process bound to all interfaces. So we test 0.0.0.0 first.
 */
function canListen(port, host) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, host);
  });
}

async function isPortFree(port) {
  // Must be free on the bind host we actually use in server.cjs
  const freeV4All = await canListen(port, "0.0.0.0");
  if (!freeV4All) return false;

  // Also try IPv6 wildcard (some Windows setups bind v4+v6 together)
  // If IPv6 isn't available, it will error and we treat that as "not blocking".
  const freeV6All = await canListen(port, "::").catch(() => true);
  return !!freeV6All;
}

/**
 * Ask OS for an available port (by listening on port 0), then close.
 */
function getEphemeralPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    // Match server bind host
    s.listen(0, "0.0.0.0", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : null;
      s.close(() => resolve(port));
    });
  });
}

function readPortFile() {
  try {
    if (!fs.existsSync(PORT_FILE)) return null;
    const raw = fs.readFileSync(PORT_FILE, "utf8").trim();
    const p = Number(raw);
    return Number.isInteger(p) && p > 0 && p < 65536 ? p : null;
  } catch {
    return null;
  }
}

function writePortFile(port) {
  try {
    fs.writeFileSync(PORT_FILE, String(port), "utf8");
  } catch {
    // ignore (persistence is helpful but not required)
  }
}

/**
 * Returns a stable port using:
 * 1) PORT env (if provided and free)
 * 2) saved .bossmind-port (if free)
 * 3) preferredDefault (if free)
 * 4) an ephemeral free port (and saves it)
 */
async function resolvePort(preferredDefault = 5000) {
  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) {
    if (await isPortFree(envPort)) {
      writePortFile(envPort);
      return envPort;
    }
  }

  const saved = readPortFile();
  if (saved && (await isPortFree(saved))) return saved;

  const def = Number(preferredDefault);
  if (Number.isInteger(def) && def > 0 && def < 65536) {
    if (await isPortFree(def)) {
      writePortFile(def);
      return def;
    }
  }

  const free = await getEphemeralPort();
  if (!Number.isInteger(free)) throw new Error("Failed to acquire an ephemeral port.");
  writePortFile(free);
  return free;
}

module.exports = { resolvePort, PORT_FILE };
