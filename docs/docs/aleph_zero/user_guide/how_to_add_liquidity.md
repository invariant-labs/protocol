---
title: How to add liquidity?

slug: /aleph_zero/user_guide/how_to_add_liquidity
---

**You can easily become a Liquidity Provider (LP) by adding your assets to a pool by following steps below:**

### Add new position to existing pool

1. Head to the "Liquidity" page and click **Add position**.

![add position](/img/docs/app/a0/a0_addposition.png)

2. This will be your position identifier. It is called the **Market ID**.

![marketid](/img/docs/app/a0/a0_marketid.png)

3. Select pair of tokens. We have chosen as an example the **AZERO/USDC** pair.

![azerousdc](/img/docs/app/a0/a0_azerousdc.png)

4. Select **fee tier**. The fee tier determines the percentage of tokens deducted from a user who makes a swap, thus defining the amount of fees you will earn when a user utilizes your liquidity in the swap. Each fee tier represents a different liquidity pool.

![feetier](/img/docs/app/a0/a0_feetier.png)

Invariant provides specific **fee values** that you can choose to create you position. For your better experience, wondering which fee should choose, for some positions we highlighted which option is most recommended.

<blockquote>
The fees you earn on your liquidity position come from swaps initiated by other users on the platform, and the token you receive as a fee always corresponds to the token a user is giving up in their swap. For example, if you have a AZERO/USDC liquidity position, you'll earn a fee in USDC when a user swaps USDC for AZERO, and vice versa. This ensures your fees directly reflect the trading activity within your chosen pool.

Users control the precision of their range orders. A tighter range (smaller difference between upper and lower limits) can generate higher fees if the price fluctuates within your set range. However, it also increases the risk of incomplete orders if the market price moves significantly before your entire range is filled. Conversely, a wider range (larger difference between upper and lower limits) results in lower fees but provides less control over the final execution price.

When selecting a range for your orders, consider the characteristics of the assets involved. For stable coins, which typically have low volatility, a narrower range may be appropriate to capture smaller price movements and maintain stability in your liquidity provision. In contrast, for more dynamic coins with higher volatility, a wider range could be advantageous to accommodate larger price fluctuations and capture potential trading opportunities. Adjusting the range based on the stability and volatility of the assets allows you to optimize your liquidity provision strategy and adapt to market conditions effectively.

</blockquote>

5. Choose between two options for adding **concentrated liquidity** and setting up the pool range.

6. Provide an amount of tokens. The amount of tokens is interdependent, as the result of multiplying them must always yield the same outcome.

- [**Uniform liquidity**](/docs/uniform_concentration) - Ideal for beginners, this option evenly distributes liquidity on both sides of the current price. It utilizes a simple slider to inform you about the potential increase in fees compared to the full range with the same amount of tokens

- [**Price range**](/docs/price_range) - Offers full customization, allowing you to set the liquidity range at any point, even on one side of the current price. This option utilizes movable flags on the chart to set the minimum and maximum price of the liquidity range.

![pricerange](/img/docs/app/a0/a0_pricerange.png)

#### Legend:

<blockquote>

- <b>yellow bold line</b> - represents current price.

- <b>lines labeled with min and max</b> - represents the user-defined liquidity range for creating position in pool.

You can switch view between <b>Bar chart</b> and <b>Line chart</b>.

</blockquote>

7. Once you're ready, click **Add Liquidity** You'll then be prompted to confirm the transaction in your wallet. A small amount of **AZERO** will be deducted from your wallet as a deposit to create your liquidity pool and position. If the pool already exists, this fee is only for creating your position, not for pool creation itself. Most of this fee will be returned to you when you decide to close your position. However, currently, closing the entire pool is not possible.

8. In the **liquidity position list**, you can easily identify your active positions. These positions will have their fee highlighted in green, indicating that they are currently generating fees.

![positions](/img/docs/app/a0/a0_positions.png)

**In the position interface, we can read data regarding:**  

**FEE TIER**
![positions](/img/docs/app/a0/a0_feetierposition.png)

**Fee Tier** represents the percentage of fees you earn based on your share in the pool. It determines how much of the pool’s fee income you receive.


**RATIO**
![positions](/img/docs/app/a0/a0_ratio.png)

**Ratio** Ratio refers to the proportion of different assets within liquidity position. It indicates how each asset is distributed relative to the total amount. This balance is important because it affects how changes in the market impact the overall value of your position.


**MIN-MAX**
![positions](/img/docs/app/a0/a0_minmax.png)

**Min-max** Range refers to the price per token within which your position earns fees. This range is defined by the minimum and maximum price limits for the token in your position. 


**VALUE**
![positions](/img/docs/app/a0/a0_value.png)

**Value** is the total worth of your position, encompassing the initial amount of liquidity you contributed and any accumulated fees. This measure is important because it provides a complete picture of your financial performance. 