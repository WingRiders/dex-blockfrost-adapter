export type LpState = {
  address: string;
  unitA: string;
  unitB: string;
  unitLp: string;
  quantityA: string;
  quantityB: string;
  issuedLpTokens: string;
};

export type LpAddressMap = Record<
  string,
  {
    address: string; // full address of the LP, there might be other LPs on this address
    unitA: string; // asset A subject
    unitB: string; // asset B subject
    unitLp: string; // lp token subject
  }
>;

export enum PoolType {
  CONSTANT_PRODUCT = "constantProduct",
  STABLESWAP = "stableswap",
}
