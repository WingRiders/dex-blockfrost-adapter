import { PoolType, WingRidersAdapter } from "@wingriders/dex-blockfrost-adapter";
import lpAddressMap from "./selectedLpsMap.json";

const DRIP_UNIT = "af2e27f580f7f08e93190a81f72462f153026d06450924726645891b44524950";

export function setupPrice(priceEl: HTMLInputElement, refreshEl: HTMLButtonElement) {
  let price: number | undefined = 0;
  const adapter = new WingRidersAdapter({
    lpAddressMap,
    projectId: import.meta.env.VITE_BLOCKFROST_PROJECT_ID,
    poolType: PoolType.CONSTANT_PRODUCT
  });
  const refresh = async () => {
    refreshEl.disabled = true;
    price = await adapter.getAdaPrice(DRIP_UNIT);
    priceEl.value = price ? `${price.toFixed(9)} ADA` : "Unable to load price";
    refreshEl.disabled = false;
  };
  refreshEl.addEventListener("click", () => refresh());
  refresh();
}
