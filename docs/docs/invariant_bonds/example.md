---
title: Example

slug: /invariant_bonds/examples
---

Seller want to sale 1 m INVT for USDC with:

- `bond_amount` = 1 000 000,
- `floor_price` = 2 USDC,
- `sale_time` = 1week,
- `up_bound` = 300%,
- `velocity` = 1.

Consider following two scenarios:

### Case 1

Someone instantly buy 1 000 000 INVT.  
$$\operatorname{PRICE}=2+\frac{1}{2} \cdot 300\% \cdot 2 \operatorname{USDC}=5 \operatorname{USDC}$$

So buyer must paid 5 000 000 USDC.

### Case 2

Only one person makes 28 proportionally equal trades every 6 hours, so he always has price equal to $2 \operatorname{USDC}+\frac{1}{2}\cdot\frac{1}{28}\cdot 300\%\cdot 2 \operatorname{USDC}\approx 2.107143\operatorname{USDC}$ (due to $\operatorname{velocity}=1$).
So buyer must paid 2 107 143 USDC.

### Limit case

In general when person makes ${n\rightarrow\infty}$ proportionally equal trades, the price is equal to 2 USDC.

![limit case](/img/docs/math/limit_case.svg)
