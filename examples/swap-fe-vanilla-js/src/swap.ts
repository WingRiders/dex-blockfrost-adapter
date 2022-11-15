import { Address, BigNum, BigInt as RBigInt } from "@dcspark/cardano-multiplatform-lib-browser";
import {
  REQUEST_BATCHER_FEE,
  REQUEST_OIL,
  REQUEST_SCRIPT_HASH,
  WingRidersAdapter,
  assetClassFromUnit,
} from "@wingriders/dex-blockfrost-adapter";
import { RequestDatum, RequestMetadaDatum, SwapAction, SwapDirection } from "@wingriders/dex-serializer";
import { debounce } from "rambdax";
import * as L from "lucid-cardano";
import lpAddressMap from "./selectedLpsMap.json";
import { fromHex } from "lucid-cardano";

const MELD_UNIT = "6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d104d454c44";
const SLIPPAGE_IN_BASIS = "50";

const WALLET_NAME = {
  nufi: "NuFi",
  eternl: "Eternl",
  nami: "Nami",
};

/* you can put any CIP30 compatible wallet here */
const USED_WALLET: keyof typeof WALLET_NAME = "nufi";

export async function setupSwap(parent: HTMLDivElement) {
  const connectButton = parent.querySelector<HTMLButtonElement>("#connect")!;
  const swapAmountInput = parent.querySelector<HTMLInputElement>("#swapAmount")!;
  const expectedAmountField = parent.querySelector<HTMLSpanElement>("#expectedAmount")!;
  const minReceiveAmountField = parent.querySelector<HTMLSpanElement>("#minAmount")!;
  const swapButton = parent.querySelector<HTMLButtonElement>("#swap")!;

  const adapter = new WingRidersAdapter({
    lpAddressMap,
    projectId: import.meta.env.VITE_BLOCKFROST_PROJECT_ID,
  });

  let lucid: L.Lucid | null = null;

  // the wallet API
  // the interface is documented in https://cips.cardano.org/cips/cip30/
  let walletApi: any | null;
  let owner: string | null;
  const initialize = async () => {
    if (!window.cardano?.[USED_WALLET]) {
      alert(`Please install ${WALLET_NAME[USED_WALLET]} to test this app`);
      return;
    }
    connectButton.disabled = true;
    connectButton.innerText = "Connecting...";

    // initialize lucid
    lucid = await L.Lucid.new(
      new L.Blockfrost(
        "https://cardano-mainnet.blockfrost.io/api/v0",
        import.meta.env.VITE_BLOCKFROST_PROJECT_ID
      ),
      "Mainnet"
    );

    try {
      walletApi = await window.cardano[USED_WALLET].enable();
      const network = await walletApi.getNetworkId();
      if (network !== 1) {
        throw new Error("Not a mainnet wallet");
      }

      owner = (await walletApi.getUsedAddresses())[0];
      if (!owner) {
        throw new Error("Unable to get wallet address");
      }
      lucid.selectWallet(walletApi);

      //update UI
      swapAmountInput.disabled = false;
      connectButton.disabled = true;
      const addr = Address.from_bytes(fromHex(owner)).to_bech32();
      connectButton.innerHTML = `Connected with ${WALLET_NAME[USED_WALLET]} <br> <tt>${addr.slice(
        0,
        13
      )}...${addr.slice(-8)}</tt>`;
    } catch (err) {
      connectButton.disabled = false;
      alert(`Unable to connect to wallet ${(err as Error).message}`);
    }
  };

  let unsignedTx: L.TxComplete | null = null;

  let recalculateId = 0;
  const recalculate = async (amount: number) => {
    swapButton.disabled = true;

    if (amount <= 0) {
      return;
    }

    unsignedTx = null;
    recalculateId += 1;
    const currentId = recalculateId;

    try {
      if (!lucid) {
        throw new Error("Tx builder not initialized");
      }
      if (!owner) {
        throw new Error("Please use an already used wallet");
      }

      // compute the expected amount
      const { expectedAmount, expectedRawAmount, swapRawAmount } = await adapter.computeExpectedSwapAmount(
        "lovelace",
        amount,
        MELD_UNIT
      );
      // compute with slippage
      const expectedTokens = BigNum.from_str(expectedRawAmount);
      const minimumTokens = expectedTokens.clamped_sub(
        expectedTokens
          .checked_mul(BigNum.from_str(SLIPPAGE_IN_BASIS))
          .checked_div_ceil(BigNum.from_str("10000"))
      );

      // Build the datum
      const ownerAddress = Address.from_bytes(fromHex(owner));
      const deadline = Date.now() + 6 * 60 * 60 * 1000; // in 6 hours
      const datum = new RequestDatum(
        new RequestMetadaDatum(
          ownerAddress,
          ownerAddress.payment_cred()!, // the owner whe can reclaim the request
          RBigInt.from_str(deadline.toFixed(0)), // deadline in posix time
          assetClassFromUnit("lovelace"), // the LP assets need to be ordered
          assetClassFromUnit(MELD_UNIT)
        ),
        new SwapAction(SwapDirection.ATOB, RBigInt.from_str(minimumTokens.to_str()))
      ).to_plutus_data();

      // compute the number of coins to be deposited with the request
      // the returned swapRawAmount is in lovelaces already
      const lockedCoins = BigNum.from_str(swapRawAmount)
        .checked_add(BigNum.from_str(REQUEST_BATCHER_FEE))
        .checked_add(BigNum.from_str(REQUEST_OIL));

      // Create a transaction that creates a swap request
      unsignedTx = await lucid
        .newTx()
        .payToContract(
          lucid.utils.credentialToAddress(lucid.utils.scriptHashToCredential(REQUEST_SCRIPT_HASH)),
          L.toHex(datum.to_bytes()),
          {
            lovelace: BigInt(lockedCoins.to_str()),
          }
        )
        .complete();

      // if there was a parallel calculation in progress
      if (currentId !== recalculateId) {
        return;
      }

      // Update the fields
      expectedAmountField.innerText = `${expectedAmount} MELD`;
      minReceiveAmountField.innerHTML = `${minimumTokens.to_str()} with ${
        Number(SLIPPAGE_IN_BASIS) / 100
      }% slippage`;
      swapButton.disabled = false;
    } catch (err) {
      console.error(err);
      alert(`An error happened: ${err}`);
      expectedAmountField.innerText = "...";
      minReceiveAmountField.innerHTML = "...";
    }
  };
  const throttledRecalculate = debounce(recalculate, 100);

  const signAndSubmit = async () => {
    if (!unsignedTx) {
      alert("Unable to create a signed tx");
      return;
    }
    swapButton.disabled = true;
    try {
      const signedTx = await unsignedTx.sign().complete();

      const txHash = await signedTx.submit();

      alert(`Transaction with hash "${txHash}" successfully submitted`);
    } catch (err) {
      alert(`Unexpected error occured ${err}`);
    }
    swapButton.disabled = false;
  };

  // Set up UI
  connectButton.addEventListener("click", initialize);
  swapAmountInput.addEventListener("input", (evt) =>
    throttledRecalculate(parseFloat((evt.target as HTMLInputElement).value))
  );
  swapButton.addEventListener("click", signAndSubmit);
}
