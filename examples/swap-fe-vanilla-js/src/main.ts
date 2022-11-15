import "./style.css";
import { setupSwap } from "./swap";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://app.wingriders.com/pools/d3fa234216901b0aa58a87cd93de69b5fef1d180a7b8cb739a74cedf54c97f01?tvlTimeSpan=1_month&transactions=all" target="_blank">
      <img src="/meld.jpg" class="logo" alt="Meld logo" />
    </a>
    <h1>Swap to MELD on WingRiders</h1>
    <div class="card" id="card">
      <button id="connect" type="button">Connect Wallet</button>
      <label for="swapAmount">Swap from ADA</label>
      <input id="swapAmount" type="number" placeholder="Enter ADA amount" name="swapAmount" min="0" disabled></input>
      <label>Expected amount</label><span id="expectedAmount" class="mono">...</span>
      <label>Minimum raw amount</label><span id="minAmount" class="mono">...</span>
      <button id="swap" type="button" disabled>Swap</button>
    </div>
  </div>
`;

setupSwap(document.querySelector<HTMLDivElement>("#card")!);
