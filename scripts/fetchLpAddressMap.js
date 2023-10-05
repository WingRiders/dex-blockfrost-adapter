const wr = require("..");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const PoolType = {
  CONSTANT_PRODUCT: "constantProduct",
  STABLESWAP: "stableswap",
};

async function fetchAndWrite() {
  const cpAdapter = new wr.WingRidersAdapter({
    projectId: process.env.BLOCKFROST_PROJECT_ID,
    poolType: PoolType.CONSTANT_PRODUCT,
  });

  const stsAdapter = new wr.WingRidersAdapter({
    projectId: process.env.BLOCKFROST_PROJECT_ID,
    poolType: PoolType.STABLESWAP,
  });

  const lpAddressMapCp = await cpAdapter.loadLpAddressMap({slowMode: true});
  const lpAddressMapSts = await stsAdapter.loadLpAddressMap({slowMode: true});

  fs.writeFileSync("dist/addressMapCp.json", JSON.stringify(lpAddressMapCp, null, "  "));
  fs.writeFileSync("dist/addressMapSts.json", JSON.stringify(lpAddressMapSts, null, "  "));
}

fetchAndWrite();
