import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import {
  BigNum,
  encode_json_str_to_plutus_datum,
  PlutusDatumSchema,
} from "@dcspark/cardano-multiplatform-lib-browser";
import { LiquidityPoolDatum, value_get_assetclass } from "@wingriders/dex-serializer";
import { assetClassFromUnit, computeLpHash } from "./utils";
import {
  INT_MAX_64,
  LIQUIDITY_POLICY_ID,
  LIQUIDITY_POOL_MIN_ADA,
  LIQUIDITY_POOL_VALIDITY_ASSET,
} from "./constants";
import { LpAddressMap, LpState } from "./types";

// LP addresses by liquidity pool hash ID

type AdapterOptions = {
  projectId: string; // see: https://blockfrost.io
  lpAddressMap?: LpAddressMap;
};

export class WingRidersAdapter {
  private api: BlockFrostAPI;
  private lpAddressMap: LpAddressMap;

  constructor({ projectId, lpAddressMap }: AdapterOptions) {
    this.api = new BlockFrostAPI({
      projectId,
    });
    this.lpAddressMap = lpAddressMap ?? {};
  }

  /**
   * Loads all liquidity pool utxo addresses from blockfrost.
   * Before doing any queries about the LP states, either this function
   * should be called, or the mapping should be provided during initialization.
   *
   * NOTE: This is a costly operation as blockfrost does not support
   * querying just based on the script credentials. Since WR LP have
   * different staking keys assigned to them, all ADA<>Token pools will
   * have a different address
   * @returns
   */
  public async loadLpAddressMap() {
    // fetch all addresses, where the LP validity token is available
    const addresses = await this.api.assetsAddresses(LIQUIDITY_POOL_VALIDITY_ASSET, {
      count: 1000,
    });
    const lpAddressMap: LpAddressMap = {};
    await Promise.all(
      addresses.map(async ({ address }) => {
        // Find all UTxOs on the addresses and verify if they are actual liquidity pools
        const utxos = await this.api.addressesUtxosAssetAll(address, LIQUIDITY_POOL_VALIDITY_ASSET);
        await Promise.all(
          utxos.map(async (utxo) => {
            if (!utxo.data_hash) {
              return;
            }

            const lpDatum = await this.getLpDatum(utxo.data_hash);
            if (!lpDatum) {
              return;
            }

            const lpHash = computeLpHash(lpDatum.assetA, lpDatum.assetB);
            lpAddressMap[lpHash] = {
              address,
              unitA: lpDatum.assetA.to_subject() || "lovelace",
              unitB: lpDatum.assetB.to_subject(),
              unitLp: `${LIQUIDITY_POLICY_ID}${lpHash}`,
            };
          })
        );
      })
    );
    this.lpAddressMap = lpAddressMap;
    return lpAddressMap;
  }

  public async getLiquidityPoolState(unitA: string, unitB: string) {
    const assetA = assetClassFromUnit(unitA);
    const assetB = assetClassFromUnit(unitB);
    const lpHash = computeLpHash(assetA, assetB);
    const lpInfo = this.lpAddressMap[lpHash];
    if (!lpInfo) {
      return;
    }

    // fetch all UTxOs on the lp address with the lp token
    // this might include invalid pools
    const utxos = await this.api.addressesUtxosAssetAll(lpInfo.address, lpInfo.unitLp);
    let lp: LpState | undefined;
    await Promise.all(
      utxos.map(async (utxo) => {
        const amountByUnit: Record<string, string> = utxo.amount.reduce(
          (acc, { unit, quantity }) => ((acc[unit] = quantity), acc),
          {}
        );

        // check if there is a validity token and a datum
        if (amountByUnit[LIQUIDITY_POOL_VALIDITY_ASSET] !== "1" || !utxo.data_hash) {
          return;
        }

        // verify the datum and hash
        let lpDatum = await this.getLpDatum(utxo.data_hash);
        if (!lpDatum || computeLpHash(lpDatum.assetA, lpDatum.assetB) !== lpHash) {
          // incorrect pool utxo
          return;
        }

        const treasuryA = value_get_assetclass(lpDatum.treasury, lpDatum.assetA);
        const treasuryB = value_get_assetclass(lpDatum.treasury, lpDatum.assetB);
        const poolMinAda = BigNum.from_str(LIQUIDITY_POOL_MIN_ADA);

        const additionalA = assetA.isAda ? treasuryA.checked_add(poolMinAda) : treasuryA;

        // compute the pool properties
        lp = {
          address: lpInfo.address,
          unitA: lpInfo.unitA,
          unitB: lpInfo.unitB,
          unitLp: lpInfo.unitLp,
          issuedLpTokens: BigNum.from_str(INT_MAX_64)
            .checked_sub(BigNum.from_str(amountByUnit[lpInfo.unitLp]))
            .to_str(),
          quantityA: BigNum.from_str(amountByUnit[lpInfo.unitA]).checked_sub(additionalA).to_str(),
          quantityB: BigNum.from_str(amountByUnit[lpInfo.unitB]).checked_sub(treasuryB).to_str(),
        };
      })
    );

    return lp;
  }

  public _getApi() {
    return this.api;
  }

  private async getLpDatum(dataHash: string): Promise<LiquidityPoolDatum | undefined> {
    const data = await this.api.scriptsDatum(dataHash);

    // NOTE: this returns the json format, but we would prefer the CBOR
    // to not lose any information about the structure
    const plutusData = encode_json_str_to_plutus_datum(
      JSON.stringify(data.json_value),
      PlutusDatumSchema.DetailedSchema
    );

    let lp: LiquidityPoolDatum;
    try {
      lp = LiquidityPoolDatum.from_hex(Buffer.from(plutusData.to_bytes()).toString("hex"));
    } catch (err) {
      // corrupt datum on a pool address
      return;
    }
    return lp;
  }
}
