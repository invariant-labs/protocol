---
title: Uniform concentration

slug: /uniform_concentration
---

Let's simplify the concept of uniform concentration to enhance transparency in liquidity provision. With uniform concentration, the liquidity range is symmetrically centered around the current token price. For instance, if the USDT/USDC pair is priced at 0.999 and we set the delta price to 0.1 percent, liquidity creation will be focused on the range of 0.998 to 1.

![liquidity legend](/img/docs/app/uniform_concentration.png)

Maintaining such a position suggests the potential to earn significantly higher fees compared to providing liquidity across the full range. For a user-friendly experience, we've introduced a concentration slider, enabling users to symmetrically boost liquidity around the current price while maximizing efficiency.

It's crucial to understand that the current price may change after you set up a pool with a specific range. If the current price moves outside your designated range, your liquidity pool will become inactive until the current price returns to your set range.
