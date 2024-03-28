---
title: How to add liquidity?

slug: /how_to_add_liquidity
---

**You can easily become a Liquidity Provider (LP) by adding your assets to a pool by following steps below:**

### Add new position to existing pool

1. Head to the "Pool" page and click **Add position**.

![add position](/img/docs/app/add_position.png)

2. Select pair of tokens. We have chosen as an example pair of stable coins.

![liquidity position](/img/docs/app/liquidity_position.png)

3. Select **fee**. Each fee represents different liquidity pool.

![fee](/img/docs/app/fee.png)

Invariant provides specific fee values that you can choose to create you position. For your better experience, wondering which fee should choose, for some positions we highlighted which option is most recommended.

<blockquote>
The fees you earn on your liquidity position come from swaps initiated by other users on the platform, and the token you receive as a fee always corresponds to the token a user is giving up in their swap. For example, if you have a SOL/USDC liquidity position, you'll earn a fee in USDC when a user swaps USDC for SOL, and vice versa. This ensures your fees directly reflect the trading activity within your chosen pool.

Users control the precision of their range orders. A tighter range (smaller difference between upper and lower limits) can generate higher fees if the price fluctuates within your set range. However, it also increases the risk of incomplete orders if the market price moves significantly before your entire range is filled. Conversely, a wider range (larger difference between upper and lower limits) results in lower fees but provides less control over the final execution price.

When selecting a range for your orders, consider the characteristics of the assets involved. For stable coins, which typically have low volatility, a narrower range may be appropriate to capture smaller price movements and maintain stability in your liquidity provision. In contrast, for more dynamic coins with higher volatility, a wider range could be advantageous to accommodate larger price fluctuations and capture potential trading opportunities. Adjusting the range based on the stability and volatility of the assets allows you to optimize your liquidity provision strategy and adapt to market conditions effectively.

</blockquote>

4. Provide amount of tokens. The amount of tokens is interdependent, as the result of multiplying them must always yield the same outcome.

5. Choose between two options for adding **concentrated liquidity** and setting up the pool range:

- [**Uniform liquidity**](/docs/uniform_concentration) - Ideal for beginners, this option evenly distributes liquidity on both sides of the current price. It utilizes a simple slider to inform you about the potential increase in fees compared to the full range with the same amount of tokens

- [**Price range**](/docs/price_range) - Offers full customization, allowing you to set the liquidity range at any point, even on one side of the current price. This option utilizes movable flags on the chart to set the minimum and maximum price of the liquidity range.

![line chart](/img/docs/app/line_chart.png)
![line chart](/img/docs/app/bar_chart.png)

#### Legend:

<blockquote>

- <b>white dashed lines</b> - represents the active liquidity range in the liquidity chart. Active liquidity is determined by the maximum price range resulting from the statistical volume of swaps for the last 7 days.

- <b>yellow bold line</b> - represents current price.

- <b>lines labeled with min and max</b> - represents the user-defined liquidity range for creating position in pool.

You can switch view between <b>Bar chart</b> and <b>Line chart</b>.

</blockquote>

6. Once you're ready, click **Add Liquidity** You'll then be prompted to confirm the transaction in your wallet. A small amount of **SOL** will be deducted from your wallet as a deposit to create your liquidity pool and position. If the pool already exists, this fee is only for creating your position, not for pool creation itself. Most of this fee will be returned to you when you decide to close your position. However, currently, closing the entire pool is not possible.

7. In the liquidity position list, you can easily identify your active positions. These positions will have their fee highlighted in green, indicating that they are currently generating fees.

![line chart](/img/docs/app/positions.png)

After some time you can observe **how price changes and take fees**, which you get from providing liquidity.

### Create new pool

![line chart](/img/docs/app/not_existing_pool.png)

It can happend that the pair of tokens that you have chosen not exist in any pool. In that case you can create it first. It's important to keep in mind, that estimated cost of creating a new pool is **0.1 SOL**

The creation process for a new pool is similar to adding liquidity to an existing one, but with two key differences. First, you won't see a preview chart of the liquidity range. Second, **you'll need to specify the starting price ratio for your chosen token pair**. It's recommended to check the global market price to ensure an accurate value.
