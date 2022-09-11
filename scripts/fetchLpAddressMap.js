const wr = require("..");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

async function fetchAndWrite() {
  const adapter = new wr.WingRidersAdapter({ projectId: process.env.BLOCKFROST_PROJECT_ID });

  const lpAddressMap = await adapter.loadLpAddressMap();

  fs.writeFileSync("dist/addressMap.json", JSON.stringify(lpAddressMap, null, "  "));
}

fetchAndWrite();
