---
title: FAQ

slug: /eclipse/user_guide/faq_tutorial
---

<!-- <details id='1' class='question'>
  <summary>
    What if during swap I got wrapped SOL instead of the chosen token?
    <a href='/docs/eclipse/user_guide/faq_tutorial#1'>#</a>
  </summary>
  <p>
    Invariant operates on the Solana blockchain, where SOL is a specific token used to handle
    transaction fees. During swapping, only the wrapped Solana token is utilized. Therefore, when
    exchanging, such as from SOL to USDC, two transactions occur under the hood:
    <ul>
      <li>SOL to wrapped SOL</li>
      <li>Wrapped SOL to USDC</li>
    </ul>
    If you receive wrapped SOL instead of your intended token, it indicates that the first
    transaction succeeded but the second did not. To swap Solana again, you must first unwrap it.
  </p>
</details> -->

<details id='2'>
  <summary>
    Is slippage tolerance effective for both minimizing losses and maximizing bonus token
    acquisition?? <a href='/docs/eclipse/user_guide/faq_tutorial#2'>#</a>
  </summary>
  <p>
    No, slippage tolerance only safeguards you from excessive costs. If the slippage benefits you,
    the transaction will proceed without interruption and you can get more tokens then expected.
  </p>
</details>

<details id='3'>
  <summary>
    Why was the fee deducted even though the transaction failed?{' '}
    <a href='/docs/eclipse/user_guide/faq_tutorial#3'>#</a>
  </summary>
  <p>
    The fee is deducted upon initiating a transaction on Invariant, irrespective of its success or
    failure. This fee covers processing the transaction. Even if the transaction fails, these costs
    are incurred and not refunded to the user, but are smaller then in case of success.
  </p>
</details>

<details id='4'>
  <summary>
    Can I claim fees at any time? <a href='/docs/eclipse/user_guide/faq_tutorial#4'>#</a>
  </summary>
  <p>
    Yes, you can claim fees from the liquidity pool whenever you desire. However, note that each fee
    claim is a separate transaction incurring a small fee. Therefore, it's advisable to claim fees
    only when necessary.
  </p>
</details>

<details id='5'>
  <summary>
    Why isn't my pool indexed by the Jupiter aggregator? <a href='/docs/eclipse/user_guide/faq_tutorial#5'>#</a>
  </summary>
  <p>
    If your pool isn't indexed yet, ensuring the following will enable its indexing:
    <ul>
      <li>
        Ensure your token exists on-chain with metadata following the Metaplex Token Metadata.
      </li>
      <li>Maintain at least $250 liquidity on both buy and sell sides.</li>
      <li>Limit buy and sell price impact to 30% to prevent single-sided liquidity markets.</li>
    </ul>
    Once these criteria are met, Jupiter automatically lists your token within minutes (usually up
    to ~30 min).
  </p>
</details>

<details id='6'>
  <summary>
    Do I need to claim fees and close my pool position separately?
    <a href='/docs/eclipse/user_guide/faq_tutorial#6'>#</a>
  </summary>
  <p>
    No, you can simply close your position, and the fees will be automatically claimed to your
    wallet.
  </p>
</details>

<details id='7'>
  <summary>
    Does the Invariant have an independent security audit?
    <a href='/docs/eclipse/user_guide/faq_tutorial#6'>#</a>
  </summary>
  <p>
    Yes, the Invariant project underwent a security audit by the Soteria team. The audit focused on the Invariant Protocol v0.1.0 Eclipse smart contract program. Audit is available here: <b><a href='https://invariant.app/audit.pdf'>Invariant Protocol Audit.</a></b>
  </p>
</details>
