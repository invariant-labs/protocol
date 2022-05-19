---
title: Introduction

slug: /introduction_bonds
---

Bonds are a pricing mechanism that allows you to purchase tokens at a cheaper price. Bond is made up of various variables. The first, floor price, defines the lowest price at which we may buy tokens. Each token purchase increases the price, which further falls in a linearly over time. The up bound parameter controls how much the price can rise, while the velocity parameter determines how fast the price hits floor price.

When a user buys a part of a bond, he or she sets a new price and pays the arithmetic mean of the previous and new prices. Each time, bond specifications are given, and the user may see in real time what price he will pay if he purchases a certain quantity of bonds.

Pure mathematical formula for price:

$$
\operatorname{max}
\left(
\operatorname{previous\_price} - \operatorname{velocity} \cdot \operatorname{up\_bound} \cdot \operatorname{floor\_price} \cdot \frac{\operatorname{current\_time}}{\operatorname{sale\_time}}, \operatorname{floor\_price}
\right)

\\+ \frac{1}{2} \cdot \frac{\operatorname{buy\_amount}}{\operatorname{bond\_amount}} \cdot \operatorname{up\_bound} \cdot \operatorname{floor\_price}
$$

### velocity

When velocity is set to 1, the price in sale_time will move from the maximum price to the floor price. Because the price reduces even quicker over time, the higher the value, the more users are rewarded.

If floor price = 25 ABC/USDC, up bound = 300 percent, and the bond lasts one week, the price might drop by as much as 10.71 in a single day.

### up_bound

Each purchase transaction raises the price by a certain percentage; the more we buy, the higher the price rises afterward. The price rises by the product of two factors, bond amount and supply ratio, in percentage terms (a percentage of how much we bought out of the entire bond).
