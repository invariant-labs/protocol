---
title: Uniform concentration

slug: /uniform_concentration
---

Let us demonstrate how uniform concentration works to make increasing liquidity more transparent. If the current price is equal to $p_c$, users can increase liquidity between $p_c -\operatorname{delta\_price}$ and $p_c +\operatorname{delta\_price}$ using this easy method. For example, if the pair USDT/USDC has a price equal to 0.999 and we set the delta price to 0.1 percent, we will only create liquidity between 0.998 and 1 prices. Holding such a position indicates that the user gets $\times$401 more from fees than adding liquidity across the full range. To demonstrate this efficiency, we offer a concentration slider, which allows you to increase liquidity symmetrically to the existing price while being n times more efficient.

For each fee tier there is associated max safe and unsafe concentration. For better understanding we prepared tables with these parameters.

### Safe strategy

![concentration](/img/docs/app/concentration.png)

| fee tier | delta price | number of ticks | concentration |
| -------- | ----------- | --------------- | ------------- |
| 0.01%    | 0.1%        | 100             | $\times$ 401  |
| 0.05%    | 2%          | 976             | $\times$ 41   |
| 0.1%     | 4%          | 1908            | $\times$ 21   |
| 0.3%     | 10%         | 5248            | $\times$ 8    |
| 1%       | 15%         | 8110            | $\times$ 5    |

### Unsafe strategy

![extremely concentration](/img/docs/app/extremely_concentration.png)

| fee tier | delta price | number of ticks | concentration |
| -------- | ----------- | --------------- | ------------- |
| 0.01%    | 0.5%        | 20              | $\times$ 2001 |
| 0.05%    | 5%          | 368             | $\times$ 109  |
| 0.1%     | 10%         | 786             | $\times$ 51   |
| 0.3%     | 30%         | 1908            | $\times$ 21   |
| 1%       | 50%         | 2796            | $\times$ 15   |
