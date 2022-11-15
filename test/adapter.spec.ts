import { WingRidersAdapter } from "../src/adapter";
import lpAddressMap from "./lpmap.mainnet.json";
import * as dotenv from "dotenv";
dotenv.config();

describe("tests", () => {
  it("lpState", async () => {
    const adapter = new WingRidersAdapter({
      projectId: process.env.BLOCKFROST_PROJECT_ID!,
      lpAddressMap,
    });
    // get WRT pool
    const lp = lpAddressMap["dec347c549f618e80d97682b5b4c6985256503bbb3f3955831f5679cdb8de72f"];
    const lpState = await adapter.getLiquidityPoolState(lp.unitA, lp.unitB);
    expect(lpState).toBeTruthy();
    expect(lpState?.address).toBe(lp.address);
    expect(BigInt(lpState!.issuedLpTokens)).toBeGreaterThanOrEqual(0n);
    expect(BigInt(lpState!.quantityA)).toBeGreaterThanOrEqual(0n);
    expect(BigInt(lpState!.quantityB)).toBeGreaterThanOrEqual(0n);
  });
});
