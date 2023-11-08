---
title: Main structure

slug: /aleph_zero/main_structure
---

In order to maintain minimal fees, we consolidate all data within a single contract. This streamlined approach significantly reduces the expenses associated with creating pools and positions. This efficiency not only minimizes costs but also simplifies the overall process, making it more accessible and user-friendly. By conducting all state changes and positioning all entrypoints exclusively within this one contract, we eliminate the complexities of interacting with and monitoring numerous external contracts. The vast majority of our data is intelligently stored using mapping, which not only preserves precious storage resources but also enhances the overall efficiency of our system.