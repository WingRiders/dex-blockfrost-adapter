import { BigNum } from "@dcspark/cardano-multiplatform-lib-browser";
import { LiquidityPoolDatum, value_get_assetclass } from "@wingriders/dex-serializer";
import {
  assetClassFromUnit,
  computeLpHash,
  computeExpectedRawSwapAmount,
  computeExpectedStsRawSwapAmount,
} from "./utils";
import {
  INT_MAX_64,
  LIQUIDITY_POLICY_ID,
  LIQUIDITY_POOL_MIN_ADA,
  LIQUIDITY_POOL_VALIDITY_ASSET,
  STABLESWAP_LIQUIDITY_POLICY_ID,
  STABLESWAP_LIQUIDITY_POOL_VALIDITY_ASSET,
} from "./constants";
import { LpAddressMap, LpState, PoolType } from "./types";
import { BlockFrostAPI } from "./blockfrost";

// LP addresses by liquidity pool hash ID

type AdapterOptions = {
  projectId: string; // see: https://blockfrost.io
  lpAddressMap?: LpAddressMap;
  poolType: PoolType;
};

type LoadLpAddressMapOptions = {
  slowMode: boolean;
};

export const dexTokenPolicy = {
  [PoolType.CONSTANT_PRODUCT]: LIQUIDITY_POLICY_ID,
  [PoolType.STABLESWAP]: STABLESWAP_LIQUIDITY_POLICY_ID,
};

export const dexValidityTokens = {
  [PoolType.CONSTANT_PRODUCT]: LIQUIDITY_POOL_VALIDITY_ASSET,
  [PoolType.STABLESWAP]: STABLESWAP_LIQUIDITY_POOL_VALIDITY_ASSET,
};

export const expectedRawSwapAmount = {
  [PoolType.CONSTANT_PRODUCT]: computeExpectedRawSwapAmount,
  [PoolType.STABLESWAP]: computeExpectedStsRawSwapAmount,
};

export class WingRidersAdapter {
  private api: BlockFrostAPI;
  private lpAddressMap: LpAddressMap;
  private poolType: PoolType;

  constructor({ projectId, lpAddressMap, poolType }: AdapterOptions) {
    const network = ["mainnet", "preprod"].filter((network) => projectId.startsWith(network))[0];
    if (!network) {
      throw new Error("Only preprod and mainnet are supported");
    }
    this.api = new BlockFrostAPI({
      projectId,
      network,
    });
    this.lpAddressMap = lpAddressMap ?? {};
    this.poolType = poolType;
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
   * @param slowMode True to fetch data sequentially. False to fetch data in parallel. Parallel often does not work with the free tier of the blockfrost api
   * @returns
   */
  public async loadLpAddressMap({ slowMode }: LoadLpAddressMapOptions | undefined = { slowMode: false }) {
    // fetch all addresses, where the LP validity token is available
    let addresses: { address: string; quantity: string }[] = [];
    let page = 1;
    while (page < 20) {
      // at most 2000
      const chunk = await this.api.assetsAddresses(dexValidityTokens[this.poolType], {
        count: 100,
        page,
      });
      addresses = addresses.concat(chunk);
      if (chunk.length < 100) {
        break;
      }
      page += 1;
    }
    const lpAddressMap: LpAddressMap = {};
    if (slowMode) {
      for (const { address } of addresses) {
        // Find all UTxOs on the addresses and verify if they are actual liquidity pools
        const utxos = await this.api.addressesUtxosAssetAll(address, dexValidityTokens[this.poolType]);
        for (const utxo of utxos) {
          await this.getLpMapEntry(address, utxo.data_hash, lpAddressMap);
        }
      }
    } else {
      await Promise.all(
        addresses.map(async ({ address }) => {
          // Find all UTxOs on the addresses and verify if they are actual liquidity pools
          const utxos = await this.api.addressesUtxosAssetAll(address, dexValidityTokens[this.poolType]);
          await Promise.all(utxos.map((utxo) => this.getLpMapEntry(address, utxo.data_hash, lpAddressMap)));
        })
      );
    }
    this.lpAddressMap = lpAddressMap;
    return lpAddressMap;
  }

  private async getLpMapEntry(address: string, data_hash: string, lpAddressMap: LpAddressMap) {
    if (!data_hash) {
      // not a pool address without
      return;
    }

    const lpDatum = await this.getLpDatum(data_hash);
    if (!lpDatum) {
      return;
    }

    const lpHash = computeLpHash(lpDatum.assetA, lpDatum.assetB);
    lpAddressMap[lpHash] = {
      address,
      unitA: lpDatum.assetA.to_subject() || "lovelace",
      unitB: lpDatum.assetB.to_subject(),
      unitLp: `${dexTokenPolicy[this.poolType]}${lpHash}`,
    };
  }

  public async getAdaPrice(unit: string): Promise<number | undefined> {
    const lpState = await this.getLiquidityPoolState("lovelace", unit);
    if (!lpState) {
      return;
    }
    const token = await this.api.assetsById(unit);
    const decimals = token?.metadata?.decimals || 0;

    const price = (Number(lpState.quantityA) * Math.pow(10, decimals - 6)) / Number(lpState.quantityB);
    return price;
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
        if (amountByUnit[dexValidityTokens[this.poolType]] !== "1" || !utxo.data_hash) {
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

        const additionalA = assetA.isAda || assetB.isAda ? treasuryA.checked_add(poolMinAda) : treasuryA;

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

  private async getLpDatum(dataHash: string): Promise<LiquidityPoolDatum | undefined> {
    const data = await this.api.scriptsDatum(dataHash);

    let lp: LiquidityPoolDatum;
    try {
      lp = LiquidityPoolDatum.from_hex(data.cbor);
    } catch (err) {
      // corrupt datum on a pool address
      return;
    }
    return lp;
  }

  /**
   * Computes the expected swap result amount for a given pair and amount.
   * The amount swapped will have an impact on the price of the tokens.
   *
   * @param unitFrom token unit to swap from
   * @param amountFrom the amount to be swapped with decimals as defined for the unit
   * @param unitTo token unit to swap to
   * @returns {expectedRawAmount, expectedAmount, swapRawAmount}
   *          with the amount corrected to decimals based on token metadata
   *          the raw amounts are the exact token quantities after decimal adjustment
   * @throws Error if LP is not found
   */
  public async computeExpectedSwapAmount(unitFrom: string, amountFrom: number, unitTo: string) {
    // the Pool will be found irrespective of the order of the tokens
    const lpState = await this.getLiquidityPoolState(unitFrom, unitTo);
    if (!lpState) {
      throw new Error("LP not found");
    }

    const [tokenFrom, tokenTo] = await Promise.all([
      this.api.assetsById(unitFrom),
      this.api.assetsById(unitTo),
    ]);

    const swapRawAmount = BigInt((amountFrom * Math.pow(10, tokenFrom.metadata?.decimals || 0)).toFixed(0));

    const [lpFromRawAmount, lpToRawAmount] = (
      unitFrom === lpState.unitA
        ? [lpState.quantityA, lpState.quantityB]
        : [lpState.quantityB, lpState.quantityA]
    ).map((amount) => BigInt(amount));

    const expectedRawAmount = expectedRawSwapAmount[this.poolType]({
      lpFromRawAmount,
      lpToRawAmount,
      swapRawAmount,
    });

    return {
      swapRawAmount: swapRawAmount.toString(),
      expectedRawAmount: expectedRawAmount.toString(10),
      expectedAmount: Number(expectedRawAmount) / Math.pow(10, tokenTo.metadata?.decimals || 0),
    };
  }
}
