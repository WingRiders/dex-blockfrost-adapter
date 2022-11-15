import { AssetClass } from "@wingriders/dex-serializer";
import { SHA3 } from "sha3";
import { SWAP_FEE_IN_BASIS } from "./constants";

function sha3(hex: string) {
  const hash = new SHA3(256);
  hash.update(hex, "hex");
  return hash.digest("hex");
}

export const compareAssets = (a: AssetClass, b: AssetClass) =>
  Buffer.from(a.policyIdHex(), "hex").compare(Buffer.from(b.policyIdHex(), "hex")) ||
  Buffer.from(a.assetNameHex(), "hex").compare(Buffer.from(b.assetNameHex(), "hex"));

const getAssetHash = (asset: AssetClass): string => sha3(asset.policyIdHex() + asset.assetNameHex());

export function computeLpHash(x: AssetClass, y: AssetClass) {
  const [a, b] = compareAssets(x, y) > 0 ? [y, x] : [x, y];
  return sha3(getAssetHash(a) + getAssetHash(b));
}

export function assetClassFromUnit(a: string) {
  if (a === "lovelace") {
    return AssetClass.from_hex("", "");
  } else {
    const policyIdHex = a.substring(0, 56);
    const assetNameHex = a.substring(56);
    return AssetClass.from_hex(policyIdHex, assetNameHex);
  }
}

export function bigintDivCeil(a: bigint, b: bigint) {
  return (a + b - BigInt(1)) / b;
}

export function computeExpectedRawSwapAmount({
  lpFromRawAmount,
  lpToRawAmount,
  swapRawAmount,
}: {
  lpFromRawAmount: bigint;
  lpToRawAmount: bigint;
  swapRawAmount: bigint;
}) {
  const swapFee = bigintDivCeil(swapRawAmount * BigInt(SWAP_FEE_IN_BASIS), BigInt(10000));

  const expectedRawAmount =
    lpToRawAmount - bigintDivCeil(lpFromRawAmount * lpToRawAmount, lpFromRawAmount + swapRawAmount - swapFee);

  return expectedRawAmount;
}
