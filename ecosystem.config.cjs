const fs = require("fs");
const path = require("path");

// Parse .env file (skip comments and empty lines)
function loadEnv(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {}
  return env;
}

const APP_DIR = "/home/ubuntu/p2pmarket";
const dotenv = loadEnv(path.join(APP_DIR, ".env"));

module.exports = {
  apps: [{
    name: "p2pmarket-api",
    script: "./artifacts/api-server/dist/index.mjs",
    cwd: APP_DIR,
    interpreter_args: "--enable-source-maps",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "512M",
    env: {
      ...dotenv,
      NODE_ENV: "production",
      PORT: dotenv.PORT || "3001",
    },
    error_file: "./logs/api-error.log",
    out_file: "./logs/api-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }]
};
