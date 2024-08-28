---
title: Uniform concentration

slug: /aleph_zero/user_guide/uniform_concentration
---

Let's simplify the concept of uniform concentration to enhance transparency in liquidity provision. With uniform concentration, the liquidity range is symmetrically centered around the current token price. For instance, if the **USDT/USDC** pair is priced at **0.999** and we set the delta price to 0.1 percent, liquidity will be alocated in the range from **0.998** to **1**.

![concentration](/img/docs/app/a0/a0_concentration.png)

Maintaining such a position suggests the potential to earn significantly higher fees compared to providing liquidity across the full range. For a user-friendly experience, we've introduced a concentration slider, enabling users to symmetrically boost liquidity around the current price while maximizing efficiency.

Liquidity positions are range-bound. If the price moves outside your set range after you add liquidity, your position will become inactive until the price returns within your chosen range.
