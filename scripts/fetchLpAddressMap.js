const wr = require("..");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

async function fetchAndWrite() {
  const adapter = new wr.WingRidersAdapter({ projectId: process.env.BLOCKFROST_PROJECT_ID });

  const slowMode = false; // you can set it to true if blockfrost gives you HTTP 429 Error
  const lpAddressMap = await adapter.loadLpAddressMap(slowMode);

  fs.writeFileSync("dist/addressMap.json", JSON.stringify(lpAddressMap, null, "  "));
}

fetchAndWrite();
