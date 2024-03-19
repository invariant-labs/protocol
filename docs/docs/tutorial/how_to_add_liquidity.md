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
The fees associated with your liquidity position will be in both tokens of the given pair. After swapping between SOL and USDC, for instance, a small amount of both SOL and USDC will be credited to your account as rewards for providing liquidity.

Users have flexibility in determining the concentration of their range orders. Opting for a broader range may result in higher fee generation in the event of price fluctuations within your range, but it also raises the risk of incomplete orders if the spot price shifts before your entire range is executed.

When selecting a range for your orders, consider the characteristics of the assets involved. For stable coins, which typically have low volatility, a narrower range may be appropriate to capture smaller price movements and maintain stability in your liquidity provision. In contrast, for more dynamic coins with higher volatility, a wider range could be advantageous to accommodate larger price fluctuations and capture potential trading opportunities. Adjusting the range based on the stability and volatility of the assets allows you to optimize your liquidity provision strategy and adapt to market conditions effectively.
</blockquote>

4. Provide value of tokens. The value of tokens is interdependent, as the result of multiplying them must always yield the same outcome.

5. Choose between two options for adding **concentrated liquidity**  and setting up the pool range:

- [**Uniform liquidity**](/docs/uniform_concentration) - Ideal for beginners, this option evenly distributes liquidity on both sides of the current price. It utilizes a simple slider to inform you about the potential increase in fees compared to the full range with the same amount of tokens

- [**Price range**](/docs/price_range) - Offers full customization, allowing you to set the liquidity range at any point, even on one side of the current price. This option utilizes movable flags on the chart to set the minimum and maximum price of the liquidity range.

![liquidity legend](/img/docs/app/liquidity_legend.png)

#### Legend: 
 
<blockquote>

 - <b>white dashed lines</b> - represents the active liquidity range in the liquidity chart. Active liquidity is determined by the maximum price range resulting from the statistical volume of swaps for the last 7 days.

 - <b>yellow bold line</b> - represents current price. 

You can switch view between <b>Bar chart</b> and <b>Line chart</b>.

</blockquote>

![line chart](/img/docs/app/line_chart.png)
![line chart](/img/docs/app/bar_chart.png)

6. When you finish, just press **Add Liquidity**. After that you will have to confirm transaction in your wallet. Notice that from your wallet will be taken also small amount of **SOL** - which is deposit to create liquidity pool. Once you decide to close this pool, most of that fee will go back to you. 

7. If you come back to liquidity position list, then you can see your active positions.  

![line chart](/img/docs/app/pool_position.png)

After some time you can observe **how price changes and take fees**, which you get from providing liquidity. 

### Create new pool

![line chart](/img/docs/app/not_existing_pool.png)

It can happend that the pair of tokens that you have chosen not exist in any pool. In that case you can create it first. It's important to keep in mind, that estimated cost of creating a new pool is **0.1 SOL**

Creation process is almost the same like for existing pool. Difference is that you don't have an preview of chart and **you should specified staring price ratio for chosen pair of tokens**. 


