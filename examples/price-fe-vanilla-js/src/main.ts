import "./style.css";
import { setupPrice } from "./price";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://app.wingriders.com/tokens/af2e27f580f7f08e93190a81f72462f153026d06450924726645891b44524950?priceGraphGranularity=24_hours&transactions=all" target="_blank">
      <img src="/drip.webp" class="logo" alt="DRIP logo" />
    </a>
    <h1>DRIP price</h1>
    <div class="card">
      <input type="text" id="price" type="button" readonly value="Loading..."></input>
      <button id="refresh" type="button" aria-label="Refresh">🔃</button>
    </div>
  </div>
`;

setupPrice(
  document.querySelector<HTMLInputElement>("#price")!,
  document.querySelector<HTMLButtonElement>("#refresh")!
);
