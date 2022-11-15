import axios, { AxiosInstance } from "axios";

/**
 * The types are copied from blockfrost-js
 */

export declare type PaginationOptions = {
  count?: number;
  page?: number;
  order?: "asc" | "desc";
};

type UTxOs = {
  /** @description Transaction hash of the UTXO */
  tx_hash: string;
  /**
   * @deprecated
   * @description UTXO index in the transaction
   */
  tx_index: number;
  /** @description UTXO index in the transaction */
  output_index: number;
  amount: {
    /**
     * Format: Lovelace or concatenation of asset policy_id and hex-encoded asset_name
     * @description The unit of the value
     */
    unit: string;
    /** @description The quantity of the unit */
    quantity: string;
  }[];
  /** @description Block hash of the UTXO */
  block: string;
  /** @description The hash of the transaction output datum */
  data_hash: string | null;
  /**
   * @description CBOR encoded inline datum
   * @example 19a6aa
   */
  inline_datum: string | null;
  /**
   * @description The hash of the reference script of the output
   * @example 13a3efd825703a352a8f71f4e2758d08c28c564e8dfcce9f77776ad1
   */
  reference_script_hash: string | null;
}[];

type Asset = {
  /**
   * @description Hex-encoded asset full name
   * @example b0d07d45fe9514f80213f4020e5a61241458be626841cde717cb38a76e7574636f696e
   */
  asset: string;
  /**
   * @description Policy ID of the asset
   * @example b0d07d45fe9514f80213f4020e5a61241458be626841cde717cb38a7
   */
  policy_id: string;
  /**
   * @description Hex-encoded asset name of the asset
   * @example 6e7574636f696e
   */
  asset_name: string | null;
  /**
   * @description CIP14 based user-facing fingerprint
   * @example asset1pkpwyknlvul7az0xx8czhl60pyel45rpje4z8w
   */
  fingerprint: string;
  /**
   * @description Current asset quantity
   * @example 12000
   */
  quantity: string;
  /**
   * @description ID of the initial minting transaction
   * @example 6804edf9712d2b619edb6ac86861fe93a730693183a262b165fcc1ba1bc99cad
   */
  initial_mint_tx_hash: string;
  /**
   * @description Count of mint and burn transactions
   * @example 1
   */
  mint_or_burn_count: number;
  /**
   * @description On-chain metadata stored in the minting transaction under label 721,
   * community discussion around the standard ongoing at https://github.com/cardano-foundation/CIPs/pull/85
   */
  onchain_metadata:
    | ({
        /**
         * @description Name of the asset
         * @example My NFT token
         */
        name?: string;
        /**
         * @description URI(s) of the associated asset
         * @example ipfs://ipfs/QmfKyJ4tuvHowwKQCbCHj4L5T3fSj8cjs7Aau8V7BWv226
         */
        image?: string | string[];
      } & {
        [key: string]: unknown;
      })
    | null;
  metadata: {
    /**
     * @description Asset name
     * @example nutcoin
     */
    name: string;
    /**
     * @description Asset description
     * @example The Nut Coin
     */
    description: string;
    /** @example nutc */
    ticker: string | null;
    /**
     * @description Asset website
     * @example https://www.stakenuts.com/
     */
    url: string | null;
    /**
     * @description Base64 encoded logo of the asset
     * @example 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
     */
    logo: string | null;
    /**
     * @description Number of decimal places of the asset unit
     * @example 6
     */
    decimals: number | null;
  } | null;
};

const MAX_PAGE = 200;

export class BlockFrostAPI {
  private api: AxiosInstance;

  constructor({ network = "mainnet", projectId }: { network: string; projectId: string }) {
    this.api = axios.create({
      baseURL: `https://cardano-${network}.blockfrost.io/api/v0`,
      timeout: 30000,
      headers: {
        project_id: projectId,
      },
    });
  }

  public async assetsAddresses(
    asset: string,
    pagination?: PaginationOptions
  ): Promise<
    {
      address: string;
      quantity: string;
    }[]
  > {
    const res = await this.api.get(`/assets/${asset}/addresses`, {
      params: pagination,
    });

    return res.data;
  }

  public async addressesUtxosAssetAll(address: string, asset: string): Promise<UTxOs> {
    let utxos: UTxOs = [];
    let foundCount = 0;
    let page = 1;
    do {
      const res = await this.api.get(`/addresses/${address}/utxos/${asset}`, {
        params: {
          count: 100,
          page,
        },
      });
      const newUtxos: UTxOs = res.data;
      foundCount = newUtxos.length;
      utxos = utxos.concat(newUtxos);
      page += 1;
    } while (foundCount > 0 && page < MAX_PAGE);
    return utxos;
  }

  public async assetsById(asset: string): Promise<Asset> {
    if (asset !== "lovelace") {
      const res = await this.api.get(`/assets/${asset}`);
      return res.data;
    } else {
      return {
        asset: "",
        policy_id: "",
        asset_name: "",
        fingerprint: "",
        initial_mint_tx_hash: "",
        metadata: {
          name: "ADA",
          decimals: 6,
          description: "ADA",
          logo: "",
          ticker: "ADA",
          url: "https://cardano.org",
        },
        mint_or_burn_count: 0,
        onchain_metadata: null,
        quantity: "",
      };
    }
  }

  public async scriptsDatum(datumHash: string): Promise<{ cbor: string }> {
    const res = await this.api.get(`/scripts/datum/${datumHash}/cbor`);
    return res.data;
  }
}
