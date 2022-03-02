---
title: Price of the token

slug: /what_is/price_of_the_token
---

The price of the tokens in Invariant is determined by the ratio of both tokens in the liquidity pool.
This ratio is given by the following formula, where:

- $L$ is liquidity,
- $x$ is the unit of the $X$ token,
- $y$ is the unit of the $Y$ token.

The formula fot the price of the token is given as follow:

$$
\begin{aligned}
\Large p=-\frac{\partial y}{\partial x}=\frac{L^2}{x}=\frac{y}{x}.
\end{aligned}
$$

Each point on a curve $xy=L^2$ can be parameterized using the variable $p$ in the following way:

$$
\begin{aligned}
\Large \varphi: (x,y) \longmapsto (\frac{L}{\sqrt{p}},L\sqrt{p}).
\end{aligned}
$$

![Liquidity graph](/img/docs/math/liquidity_graph.svg)

More about it, you can learn from our [whitepaper](https://t.co/Ms1dYZPrZx)
