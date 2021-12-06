# `contracts`

The smart contracts that power the Hop Exchange.

## Protocol Design

_For a detailed description of the protocol, please see the [whitepaper](https://hop.exchange/whitepaper.pdf)._

### Overview

The Hop protocol provides a scalable rollup-to-rollup General Token Bridge using a two-pronged approach:

1. Create a cross-network bridge token that can be quickly and economically moved from rollup to rollup or claimed on layer-1 for its underlying asset.
2. Use Automated Market Makers to swap between each bridge token and its corresponding Canonical Tokens on each rollup in order to dynamically price liquidity and incentivize the rebalancing of liquidity across the network.

The combined approach allows users to quickly and trustlessly swap between layer-2 Canonical Tokens using the specialized bridge token as an intermediary asset.

A bonder posts their funds as collateral for the system, which effectively fronts liquidity for users to easily transfer throughout each layer. All transferred funds are tracked and the system will always have funds that account for all assets within the Hop ecosystem. Transfers are fully settled and bonders credits restored when the sending layer-2 checkpoints their state onto layer-1.

Transfers can be challenged by anyone. Challenges require a challenger to put up stake and wait until the challenged transfer is fully settled. If the challenge is won, the challenger is paid out their initial stake plus some. If it is lost, the challenge stake gets credited to the system.

### Contracts

#### Bridges

**[Accounting.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/Accounting.sol)** - Abstract contract that is responsible for the accounting of the layer-1 and layer-2 bridges. A bonder can stake or unstake their funds using functions in this contract. All credits and debits are accounted for and updated in this contract.

**[Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/Bridge.sol)** - Abstract contract that inherits `Accounting.sol` and has the base, shared functionality for `L1_Bridge.sol` and `L2_Bridge.sol`. This contract's main functionality is to handle user withdrawals on any chain. It is also responsible for settling withdrawals and updating a bonder's credit. This contract has helper functions to retrieve data related to transfers.

**[L1_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L1_Bridge.sol)** - Abstract contract that inherits `Bridge.sol`. There are four main entities that will use this contract and four main functionalities within it. A **user** can use this contract to send tokens to a layer-2. A **bonder** can use this contract to bond transfer roots. An **off-chain node** will use this contract to confirm transfer roots. **Anyone** can challenge and resolve a transfer bond.

**[L1_ERC20_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L1_ERC20_Bridge.sol)** - Contract that inherits `L1_Bridge.sol`. This contract implements ERC20 transfers that are used throughout the other L1_Bridge contracts.

**[L1_ETH_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L1_ETH_Bridge.sol)** - Contract that inherits `L1_Bridge.sol`. This contract implements ETH transfers that are used throughout the other L1_Bridge contracts.

**[L2_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_Bridge.sol)** - This abstract contract inherits `Bridge.sol`. Similar to `L1_Bridge.sol`, there are four entities that will use this contract with four main functionalities within in. A **user** can use this contract to send tokens to either a layer-1 or another layer-2. . A **bonder** can bond a withdrawal on behalf of a user. An **off-chain node** will use this contract to mint new h Tokens. The **governance** entity can set various parameters.

**[HopBridgeToken.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/HopBridgeToken.sol)** - An ERC20 implementation that is controlled by `L2_Bridge.sol`. Each mainnet token is represented 1:1 by an h token (e.g., 1 mainnet DAI has a corresponding hDAI). `L2_Bridge.sol` handles the minting/burning of these tokens. The bridge contract also performs some transfers, however, transfers can also be made by calling this contract directly.

**[L2_ArbitrumBridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_ArbitrumBridge.sol) / [L2_OptimismBridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_OptimismBridge.sol) / [L2_XDaiBridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_XDaiBridge.sol)** - These contracts inherit `L2_Bridge.sol` and add layer-2 specific implementation details. These are the contracts that will be deployed on each layer-2.

### Definitions

- **Transfer** - The data for a transfer from one chain to another.
- **TransferId** - The hash of a single transfer's data.
- **TransferRoot** - The merkle root of a tree of TransferIds and associated metadata such as the destination chainIds and totals for each chain.
- **TransferRootId** - The hash of a TransferRoot's hash and total amount.
- **Bridge** - A hop bridge contracts on layer-1 or layer-2 ("L1 Bridge", "Hop Bridge", "Arbitrum Bridge", "Optimism Bridge")
- **Canonical Token Bridge** - A Rollup's own token bridge. ("Canonical Arbitrum Bridge", "Canonical Optimism Bridge")
- **Challenge** - A staked claim that a transfer is invalid. Anyone can challenge a transfer and will be rewarded or punished accordingly.
- **h Tokens** - Hop Bridge Tokens (e.g., ”Hop ETH”, ”Hop DAI” with symbols ”hETH”, ”hDAI” respectively) are specialized L2 tokens that can be transferred rollup-to-rollup in batches and act as intermediary assets in the Hop protocol.
- **Rescue** - A TransferRoot that was incorrectly bonded can be rescued (refunded) to the governance address after a certain amount of time.

### Diagrams

- For detailed diagrams of the system, please see [here](https://github.com/hop-exchange/contracts/tree/master/assets)
  - [Detailed Transaction Diagrams](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Transfer_Diagrams.jpg)
  - [Contract Inheritance](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Contract_Inheritance_Diagram.jpg) 

### Expected Usage

In the happy path case, a user will send tokens from one layer to another and receive the tokens on the receiving chain within seconds. The Bonder (an off-chain node) will be running and will facilitate the transfers by calling bonded withdrawal functions on the receiving chain.

In the non-happy path, the Bonder will be offline. In this case, users will still send tokens from one layer to another, however, they will be unable to withdraw on the receiving chain until the sending chain relays the transfer to layer-1 via the sending chain's messenger.

Many transfers can be made from a given layer-2 before they are confirmed on layer-1 as a single bundle called a TransferRoot. After a certain number of transactions or a certain amount of time, a Bonder will bond a Transfer Root via a transaction on the layer-1 chain. This consists of bonding 110% of the Transfer Root's amount and sends the Transfer Roots to each layer-2.

The system keeps track of the Bonder's credit and debit. Credit and debit only increment, and debit can never exceed credit. Credit is added to the Bonder's credit account each time funds are staked. Debit is added to the Bonder's debit account each time staked funds are unstaked. Credit is added to the Bonder's credit account each time transactions (from/to any chain) are successfully confirmed on layer-1. Debit is added to the Bonder's debit account each time transactions are sent (from/to any chain) but not yet confirmed on layer-1. A bonder stakes on each supported chain and the accounting system for each layer is independent of each other layer.

Transfer Roots can be challenged by anyone. When a Transfer Root is bonded, the Bonder puts up a challenger bounty equal to 10% of the Transfer Root bond. A challenge consists of a challenger putting up an equal stake and waiting until the challenged Transfer Root is fully confirmed. If the challenge is won, the challenger’s stake is returned on top of 75% of the Bonder's challenger bounty. The remaining 25% of the bounty is burned. If the challenge is lost, the challenger’s stake is credited to the Bonder.

TransferRoots can be rescued if they are created in error. In the case where a TransferRoot is incorrectly created, the funds will be locked. After a certain amount of time, the TransferRoot and its associated funds can be rescued by the governance account.

### Expected Contract Invocation

#### Transfers

These are the expected, happy-path cases for users to send and receive funds on each layer.

- **L1 -> L2**

  - User calls `L1_Bridge.sendToL2()`
    - Funds will show up on the appropriate layer-2 through the canonical layer-2 messenger

- **L2 -> L1**

  - User calls `L2_Bridge.swapAndSend()`
  - Bonder calls `L1_Bridge.bondWithdrawal()`

- **L2 -> L2**
  - User calls `L2_Bridge.swapAndSend()` on the sending layer-2
  - Bonder calls `L2_Bridge.bondWithdrawalAndDistribute()` on the receiving layer-2

If the bonder is offline, the system relies on the canonical layer-2 bridge to settle transactions on layer-1.

- **L2 -> L1 (bonder offline)**

  - User calls `L2_Bridge.swapAndSend()`
  - 512 transactions are sent or `L2_Bridge.commitTransfer()` is called by anyone after 1 day
  - Wait for the sending layer-2 to be confirmed on layer-1 (approximately 7 days)
  - User or Relayer calls `L1_Bridge.withdraw()`

- **L2 -> L2 (bonder offline)**
  - User calls `L2_Bridge.swapAndSend()` on the sending layer-2
  - 512 transactions are sent or `L2_Bridge.commitTransfer()` is called by anyone after 1 day on the sending layer-2
  - Wait for the sending layer-2 to be confirmed on layer-1 (approximately 7 days)
  - User or Relayer calls `L2_Bridge.withdraw()` on the receiving layer-2

#### Transfer Roots

The bonder settles transactions and accounting with the following functions:

- Bonder calls `L2_Bridge.commitTransfers()`
- Bonder calls `L1_Bridge.bondTransferRoot()`
- Bonder calls `settleBondedWithdrawals()` on every chain
- Wait 7 days and `L1_Bridge.confirmTransferRoot()` is triggered and settles all accounting

#### Challenges

Anyone can challenge transactions:

- Anyone calls `L1_Bridge.challengeTransferBond()`
- After the challenge resolution period has ended, anyone calls `L1_Bridge.resolveChallenge()`

## Contract Addresses

Please see [`./config/networks/mainnet.ts`](https://github.com/hop-protocol/contracts/blob/master/config/networks/mainnet.ts) for all deployed contract addresses.

## Tokens

- **Canonical L1 Token** - The layer-1 token that is being bridged.
  ("Canonical L1 ETH", "Canonical L1 DAI", "DAI", "ETH")
- **hToken** - Exists on layer-2 and represents the right to 1 Token deposited in the layer-1 bridge.
  hToken's can be converted to their Canonical L1 Token or vice versa at a 1:1 rate.
  ("hDAI", "hETH")
- **Canonical L2 Token** - The primary layer-2 representation of a Canonical L1 Token. This is the
  token you get from depositing into a rollup's Canonical Token Bridge.

## Token Path

On Hop, tokens are always converted along the following path. To convert DAI to Arbitrum DAI, DAI (on layer-1) is first converted to hDAI (on layer-2) using the layer-1 Hop Bridge. Then the hDAI is swapped for Arbitrum DAI through the AMM market. This can be done in one transaction by calling `sendToL2AndAttemptSwap`.

```
      Layer 1          |      Layer 2
                       |
Canonical L1 Token <---|---> hToken <--(AMM)--> Canonical L2 Token
                       |
```

e.g.

```
      Layer 1          |      Layer 2
                       |
DAI <--------------<---|---> hDAI <----(AMM)--> Arbitrum DAI
                       |
```

## Temporary Steps for Deploying on Optimism
Because Optimism does not support the OpenZeppelin contracts out of the box, these steps must be followed to deploy with patched OpenZeppelin contracts.
```
# Deploy L1
rm package-lock.json && rm -rf node_modules && rm -rf cache && rm -rf artifacts && npm i
[Comment out Deploy L2, Setup L1, and Setup L2 in deploy.ts]
npm run deploy

# Deploy L2
npm run patch-oz
npm run deploy

# Setup L1
rm -rf node_modules/@openzeppelin && rm -rf cache && rm -rf artifacts && npm i
npm run deploy

# Setup L2
npm run patch-oz
npm run deploy
```

## Event Signatures

### Accounting
`Stake(address,uint256)`: 0xebedb8b3c678666e7f36970bc8f57abf6d8fa2e828c0da91ea5b75bf68ed101a
`Unstake(address,uint256)`: 0x85082129d87b2fe11527cb1b3b7a520aeb5aa6913f88a3d8757fe40d1db02fdd
`BonderAdded(address)`: 0x2cec73b7434d3b91198ad1a618f63e6a0761ce281af5ec9ec76606d948d03e23
`BonderRemoved(address)`: 0x4234ba611d325b3ba434c4e1b037967b955b1274d4185ee9847b7491111a48ff

### Bridge
`Withdrew(bytes32,address,uint256,bytes32)`: 0x9475cdbde5fc71fe2ccd413c82878ee54d061b9f74f9e2e1a03ff1178821502c
`WithdrawalBonded(bytes32,uint256)`: 0x0c3d250c7831051e78aa6a56679e590374c7c424415ffe4aa474491def2fe705
`WithdrawalBondSettled(address,bytes32,bytes32)`: 0x84eb21b24c31b27a3bc67dde4a598aad06db6e9415cd66544492b9616996143c
`MultipleWithdrawalsSettled(address,bytes32,uint256)`: 0x78e830d08be9d5f957414c84d685c061ecbd8467be98b42ebb64f0118b57d2ff
`TransferRootSet(bytes32,uint256)`: 0xb33d2162aead99dab59e77a7a67ea025b776bf8ca8079e132afdf9b23e03bd42

### L1 Bridge
`TransferSentToL2(uint256,address,uint256,uint256,uint256,address,uint256)`: 0x0a0607688c86ec1775abcdbab7b33a3a35a6c9cde677c9be880150c231cc6b0b
`TransferRootBonded(bytes32,uint256)`: 0xa57b3e1f3af9eca02201028629700658608222c365064584cfe65d9630ef4f7b
`TransferRootConfirmed(uint256,uint256,bytes32,uint256)`: 0xfdfb0eefa96935b8a8c0edf528e125dc6f3934fdbbfce31b38967e8ff413dccd
`TransferBondChallenged(bytes32,bytes32,uint256)`: 0xec2697dcba539a0ac947cdf1f6d0b6314c065429eca8be2435859b10209d4c27
`ChallengeResolved(bytes32,bytes32,uint256)`: 0x4a99228a8a6d774d261be57ab0ed833bb1bae1f22bbbd3d4767b75ad03fdddf7

### L2 Bridge
`TransfersCommitted(uint256,bytes32,uint256,uint256)`: 0xf52ad20d3b4f50d1c40901dfb95a9ce5270b2fc32694e5c668354721cd87aa74
`TransferSent(bytes32,uint256,address,uint256,bytes32,uint256,uint256,uint256,uint256)`: 0xe35dddd4ea75d7e9b3fe93af4f4e40e778c3da4074c9d93e7c6536f1e803c1eb
`TransferFromL1Completed(address,uint256,uint256,uint256,address,uint256)`:  0x320958176930804eb66c2343c7343fc0367dc16249590c0f195783bee199d094
## FAQ

- Why are my Optimism contracts not working?

  - Optimism adds additional bytecode to your contracts when they are compiled. This may push your contract over the contract size limit. When this happens, your contract deployment mail fail silently (the transaction will succeed but there will be no code at the address). Try removing unused functions from your contracts.

- Why can I not interact with contracts on xDai?

  - Interacting with xDai contracts sends a negative default `gasLimit`. To resolve this issue, add `overrides` with a defined `gasLimit` with each contract invocation.

- Why do my Optimism contract interactions appear to work but do not update state?

  - If `overrides` are added to Optimism contract invocations, the code will say the tx has succeeded, but no state will be updated.

- Why do my Optimism deployments and transactions sometimes hang?

  - Optimism seems to have introduced a denylist for some addresses on their public chain. Addresses that have interacted with their old public chain have seemingly been denylisted on their newest one.
