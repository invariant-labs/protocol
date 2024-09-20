---
title: Get Started

slug: /vara/get_started
---

This guide will walk you through the essential steps to get started on our [platform](https://vara.invariant.app/), from connecting your wallet and requesting an airdrop to adding a liquidity position, swapping tokens, claiming fees, and closing your position. If you encounter any issues, check out the more detailed User Guide. If you have any questions, feel free to join our community on [Invariant's Discord](https://discord.gg/w6hTeWTJvG) for support. Please note that this walkthrough is on the testnet.

### Connect your wallet

To begin using Invariant, you'll need to connect your wallet. Follow these steps:

1. Click on the **"Connect wallet"** button at the top right corner of the page or or in the swap area.
   ![Connect wallet](/img/docs/app/vara/vara_connectwallet.jpg)

2. Select your wallet provider (in this tutorial we are using SubWallet).
   ![SubWallet](/img/docs/app/vara/vara_choosewallet.jpg)

3. Follow the prompts to authorize the connection, and you are ready to go with your wallet connected.

### Request airdrop from Vara Network Faucet

To start interacting with the Invariant platform on the Vara Network testnet, you will need some [testnet tokens](/docs/vara/user_guide/faucet). You can request these tokens from the Vara Network Faucet. 

1. Open your web browser and navigate to the [Vara Network Faucet page](https://idea.gear-tech.io/programs?node=wss%3A%2F%2Ftestnet.vara.network).

![A0 Faucet](/img/docs/app/vara/vara_faucetpage.png)

2. Connect your wallet to the **Vara Network** portal.

![Connect to Vara Faucet](/img/docs/app/vara/vara_connectfaucet.jpg)

3. After connecting your wallet, click the icon under **"Transferable Balance"**.

![Nightly wallet](/img/docs/app/vara/vara_faucetbalance.jpg)

4. Click **"Get Test Balance"**

![Paste adress](/img/docs/app/vara/vara_getbalance.jpg)

5. Solve the captcha you are going to see after clicking **"Get Test Balance"** button.

After few second, airdrop of testnet **TVARA** should be in your wallet.

### Request airdrop from Invaraint Faucet

Now that you have testnet tokens to approve transactions on the Vara Network Testnet, you can request an airdrop from Invariant. You will receive testnet BTC, ETH, and USDC.

1. Click the **"Faucet"** button on Invariant site.

![Buttons](/img/docs/app/vara/vara_nav.jpg)

2. Approve transaction in your wallet

![Approve transaction](/img/docs/app/vara/vara_approvetransaction.jpg)

3. After a while, you should have airdropped tokens in your wallet.

### Add liquidity

Adding a liquidity position allows you to earn fees from trades on the Invariant DEX. To [add a position](/docs/vara/user_guide/how_to_add_liquidity) follow these steps:

1. Go to the **"Liqudity"** tab and click on **"Add Position"** button.

![Add position](/img/docs/app/a0/a0_addposition.png)

2. Choose the tokens you want to provide liquidity for.

![Select tokens](/img/docs/app/vara/vara_selecttokens.jpg)

3. Select fee tier. The fee tier determines the percentage of tokens deducted from a user who makes a swap, thus defining the amount of fees you will earn when a user utilizes your liquidity in the swap. Each fee tier represents a different liquidity pool.

![Fee tier](/img/docs/app/vara/vara_selectfeetier.jpg)

4. Specify the price range within which you want to provide liquidity This range determines where your tokens will be active in the market. You will earn fees only when trades occur within this range. Adjust the min and max price sliders to set your range.

![Price range](/img/docs/app/vara/vara_pricerange.jpg)

5. Enter the amount you want to contribute to the liquidity pool. Please note that you need to provide both tokens in the correct ratio.

![Deposit amount](/img/docs/app/vara/vara_depositamount.jpg)

6. Click **"Add Position"** button

![Add position](/img/docs/app/vara/vara_addpositionclick.jpg)

### Exchange tokens

Now you can use testnet tokens, that you received form Airdrop. This point will show you [how to perform swap](/docs/vara/user_guide/how_to_swap) with this tokens.

1. Navigate to **"Exchange tab"**.

2. Select the tokens you wish to swap. A modal will appear where you can choose a specific token by either entering its name or selecting one from the list. Additionally, you can add a token by clicking the plus button and providing its token address. In this example, we're swapping from AZERO to USDC.

![Swap](/img/docs/app/vara/vara_searchtoken.jpg)

3. Enter the amount of tokens you want to swap. To swap all tokens from your wallet, simply click **“Max”**.

![Swap](/img/docs/app/vara/vara_exchange.jpg)

4. Click **"Exchange"** and confirm the transaction in your wallet. Your swapped tokens will appear in your wallet once the transaction is completed.

![Swap](/img/docs/app/vara/vara_exchangelight.jpg)

**Potential problems:**

- **Insufficient balance** - this means that your balance is smaller than the amount of tokens you want to swap. To fix this, try swapping fewer tokens.

![Swap](/img/docs/app/vara/vara_insufficientbalance.jpg)

- **Insufficient liquidity** - this means that there is not enough liquidity in the pool to perform your swap. To fix this, add more liquidity or decrease the amount of tokens you want to swap.

![Swap](/img/docs/app/vara/vara_insufficientliquidity.jpg)

- **Insufficient volume** - this means that you probably did not enter any tokens in the exchange window.

![Swap](/img/docs/app/vara/vara_insufficientvolume.jpg)

### Claim fees

As a liquidity provider, you can [claim your earned fees](/docs/vara/user_guide/how_to_claim_fee). To claim fees:

- Navigate to the **"Liquidity"** section and open the position from which you want to claim fees.

- Click on **"Claim Fee"** to initiate the transaction.

![Claim fees](/img/docs/app/vara/vara_claimfee.jpg)

- Confirm the transaction in your wallet.
- Your claimed fees will be added to your wallet balance.

### Close position

If you want to [close your position](/docs/vara/user_guide/how_to_remove_liquidity) and remove liquidity, you can do this even if your fees are unclaimed. The fees after closing the position will be sent to your wallet along with the liquidity.

- Navigate to the **"Liquidity"** section and open the position which you want to close.

- Click **"Close Position"** and confirm the transaction in your wallet. Deposited tokens as well as unclaimed fees will be transferred to your wallet

![Position details](/img/docs/app/vara/vara_closeposition.jpg)
