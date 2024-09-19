---
title: How to list your own token?

slug: /practical_guides/how_to_list_your_token
---

If you want your token to be traded on Invariant, the process is simple, fast, and permissionless. Follow the steps below to list your token and create a liquidity pool for it.

# Adding your token to the tokens list

1. Connect your wallet. If you don't have a wallet yet, we recommend using [Nightly](https://nightly.app/).

![slippage](/img/docs/app/token_list/tl_connectwallet.png)  


1. Go to the **Liquidity** tab in the Invariant dApp.

![liquiditytab](/img/docs/app/token_list/tl_liquiditytab.jpg)

3. Click on the **"Add Position"** button. 

![slippage](/img/docs/app/token_list/tl_addpool.png)


4. Search for your token. If your token is not listed, click the **"Add Token"** button. 

![slippage](/img/docs/app/token_list/tl_addyourtoken.jpg)

5. Copy and paste your token’s contract address into the designated field and confirm by clicking **"Add"**.

![slippage](/img/docs/app/token_list/tl_entertokenadress.jpg)

6. Your token should now appear in the token list, ready for use.

# Creating liquidity pool for your token

To make your token tradable, you need to create a liquidity pool. Follow these steps:

1. **Select tokens** - After adding your token to the list, select it and choose a pair token you want to create a liquidity pool with.

![select_tokens](/img/docs/app/token_list/tl_selecttoken.jpg)

2. **Select a Fee Tier** - Choosing the right fee tier is crucial because it affects various aspects of pool performance. Lower fee tiers often attract higher trading volumes, which can help boost your token’s visibility and exposure. However, this comes at the cost of generating lower fees per trade. On the other hand, higher fee tiers can lead to greater revenue per trade but might reduce trading volume.
To find the best fit for your needs, it’s recommended to create multiple pools with different fee tiers and observe their performance. There’s no need to limit yourself to just one. Each fee tier operates in its own pool, so for example, if you create a pool with a **0.01%** fee tier and later decide to add another with a **0.1%** fee tier, it will be a completely separate pool.

![select_feetier](/img/docs/app/token_list/tl_feetierslist.jpg)

3. **Set initial price** -  If your token is new with no market value, you will need to set an initial price when creating the first pool at a given fee tier.

![initial_price](/img/docs/app/token_list/tl_initprice.jpg)

4. **Set a Price Range** - .At this point, you need to choose a price range for your token. In this tutorial we are using **Classic Liquidity Pool(CPAMM)**.

![price_range](/img/docs/app/token_list/tl_setpricerange.jpg)

5. **Enter Tokens Amount** - After setting the initial price and price range, you are ready to enter the number of tokens you want to add to the pool. In a **Classic Liquidity Pool**, a 50:50 value ratio of tokens must be maintained.

![price_range](/img/docs/app/token_list/tl_invariantamount.jpg)

6. **Add Your Pool** - After entering all the required values, click **"Add Position"** to finalize the pool creation. Your liquidity is now active, and other users can trade your token on Invariant.

![price_range](/img/docs/app/token_list/tl_addposition.jpg)

7. **Visit the “Statistics” tab** - Check out how your pools perform over time.

![statistics](/img/docs/app/token_list/tl_statistics.jpg)
