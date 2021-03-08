# `contracts`

The smart contracts that power the Hop Exchange.

## Protocol Design

_For a detailed description of the protocol, please see the [whitepaper](https://hop.exchange/whitepaper.pdf)._

### Overview

The Hop protocol provides a scalable rollup-to-rollup General Token Bridge using a two-pronged approach:

1. Create a cross-network bridge token that can be quickly and economically moved from rollup to rollup or claimed on layer-1 for its underlying asset.
2. Use Automated Market Makers to swap between each bridge token and its corresponding Canonical Tokens on each rollup in order to dynamically price liquidity and incentivize the rebalancing of liquidity across the network.

The combined approach allows users to quickly and trustlessly swap between layer-2 Canonical Tokens using the specialized bridge token as an intermediary asset.

A bonder posts their funds as collateral for the system, which effectively fronts liquidity for users to easily transfer throughout each layer. All transferred funds are tracked and and the system will always have funds that account for all assets within the Hop ecosystem. Transfers are fully settled and bonders credits restored when the sending layer-2 checkpoints their state onto layer-1.

Transfers can be challenged by anyone. Challenges require a challenger to put up stake and wait until the challenged transfer is fully settled. If the challenge is won, the challenger is paid out their initial stake plus some. If it is lost, the challenge stake gets credited to the system.

### Contracts

#### Bridges

**[Accounting.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/Accounting.sol)** - Abstract contract that is responsible for the accounting of the layer-1 and layer-2 bridges. A bonder can stake or unstake their funds using functions in this contract. All credits and debits are accounted accounted for and updated in this contract.

**[Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/Bridge.sol)** - Abstract contract that inherits `Accounting.sol` and has the base, shared functionality for `L1_Bridge.sol` and `L2_Bridge.sol`. This contract's main functionality is to handle user withdrawals on any chain. It is also responsible for settling withdrawals and updating a bonder's credit. This contract has helper functions to retrieve data related to transfers.

**[L1_BridgeConfig.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L1_BridgeConfig.sol)** - This contract contains getters and setters for L1_Bridge related variables. Most of these variables are associated with challenges.

**[L1_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L1_Bridge.sol)** - This contract inherits `Bridge.sol` and `L1_BridgeConfig.sol`. There are four main entities that will use this contract and four main functionalities within it. A **user** can use this contract to send tokens to a layer-2. A **bonder** can use this contract to bond transfer roots. An **off-chain node** will use this contract to confirm transfer roots. **Anyone** can challenge and resolve a transfer bond.

**[L2_Bridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_Bridge.sol)** - This abstract contract inherits `Bridge.sol` and `ERC20.sol`. Similar to `L1_Bridge.sol`, there are four entities that will use this contract with four main functionalities within in. A **user** can use this contract to send tokens to either a layer-1 or a layer-2. They can also withdraw their tokens on an L2 through this contract. A **bonder** can bond a withdrawal on behalf of a user. An **off-chain node** will use this contract to mint new h Tokens. The **governance** entity can set various parameters.

This contract is also an ERC20 contract that represents as an h token. Each mainnet token is represented 1:1 by an h token (e.g., 1 mainnet DAI has a corresponding hDAI). This bridge handles the minting/burning, transfers, and all ERC20 related functionality of these h tokens.

**[L2_ArbitrumBridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_ArbitrumBridge.sol) / [L2_OptimismBridge.sol](https://github.com/hop-exchange/contracts/blob/master/contracts/bridges/L2_OptimismBridge.sol)** - These contracts inherit `L2_Bridge.sol` and add layer-2 specific implementation details. These are the contracts that will be deployed on each layer-2.

### Definitions

- **Transfer** - The data for a transfer from one chain to another.
- **TransferId** - The hash of a single transfer's data.
- **TransferRoot** - The merkle root of a tree of TransferHashes and associated metadata such as the destination chainIds and totals for each chain.
- **TransferRootId** - The hash of a transfer root's hash and total amount.
- **Bridge** - A hop bridge contracts on layer-1 or layer-2 ("L1 Bridge", "Hop Bridge", "Arbitrum Bridge", "Optimism Bridge")
- **Canonical Token Bridge** - A Rollup's own token bridge. ("Canonical Arbitrum Bridge", "Canonical Optimism Bridge")
- **Challenge** - A staked claim that a transfer is invalid. Anyone can challenge a transfer and will be rewarded or punished accordingly.
- **h Tokens** - Hop Bridge Tokens (e.g., ”Hop ETH”, ”Hop DAI” with symbols ”hETH”, ”hDAI” respectively) are specialized L2 tokens that can be transferred rollup-to-rollup in batches and act as intermediary assets in the Hop protocol.

### Diagrams

- For detailed diagrams of the system, please see [here](https://github.com/hop-exchange/contracts/tree/master/assets)
  - [Detailed Transaction Diagrams](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Contract_Inheritance_Diagram.jpg)
  - [Contract Inheritance](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Transfer_Diagrams.jpg)


### Expected Usage

In the happy path case, a user will send tokens from one layer to another and receive the tokens on the receiving chain within seconds. The Bonder (an off-chain node) will be running and will facilitate the transfers by calling bonded withdrawal functions on the receiving chain.

In the non-happy path, the Bonder will be offline. In this case, users will still send tokens from one layer to another, however, they will be unable to withdraw on the receiving chain until the sending chain relays the transfer to layer-1 via the sending chain's messenger.

Many transfers can be made from a given layer-2 before they are confirmed on layer-1 as a single bundle called a Transfer Root. After a certain number of transactions or a certain number of hours, a Bonder will bond a Transfer Root via a transaction on the layer-1 chain. This consists of bonding 110% of the Transfer Root's amount and sends the Transfer Roots to each layer-2.

The system keeps track of the Bonder's credit and debit. Credit and debit only increment, and debit can never exceed credit. Credit is added to the Bonder's credit account each time funds are staked. Debit is added to the Bonder's debit account each time staked funds are unstaked. Credit is added to the Bonder's credit account each time transactions (from/to any chain) are successfully confirmed on layer-1. Debit is added to the Bonder's debit account each time transactions are sent (from/to any chain) but not yet confirmed on layer-1. A bonder stakes on each supported chain and the accounting system for each layer is independent of each other layer.

Transfer Roots can be challenged by anyone. When a Transfer Root is bonded, the Bonder puts up a challenger bounty equal to 10% of the Transfer Root bond. A challenge consists of a challenger putting up an equal stake and waiting until the challenged Transfer Root is fully confirmed. If the challenge is won, the challenger’s stake is returned on top of 75% of the Bonder's challenger bounty. The remaining 25% of the bounty is burned. If the challenge is lost, the challenger’s stake is credited to the Bonder.


### Expected Contract Invocation

#### Transfers

These are the expected, happy-path cases for users to send and receive funds on each layer.

- **L1 -> L2**
  - User calls `L1_Bridge.sendAndAttemptSwap()`
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
  - `L2_Bridge.commitTransfer()` is called by anyone after 100 txs or after 4 hours
  - Wait for the sending layer-2 to be confirmed on layer-1 (usually 7 days)
  - User or Relayer calls `L1_Bridge.withdraw()`

- **L2 -> L2 (bonder offline)**
  - User calls `L2_Bridge.swapAndSend()` on the sending layer-2
  - `L2_Bridge.commitTransfer()` is called on the sending layer-2 by anyone after 100 txs or after 4 hours
  - Wait for the sending layer-2 to be confirmed on layer-1 (usually 7 days)
  - User or Relayer calls `L2_Bridge.withdrawAndAttemptSwap()` on the receiving layer-2

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

Please see [`./config/addresses.ts`](https://github.com/hop-exchange/contracts/blob/master/config/addresses.ts) for all deployed contract addresses.

## Tokens

- **Canonical L1 Token** - The layer-1 token that is being bridged.
  ("Canonical L1 ETH", "Canonical L1 DAI", "DAI", "ETH")
- **hToken** - Exists on layer-2 and represents the right to 1 Token deposited in the layer-1 bridge.
  hToken's can be converted to their Canonical L1 Token or vice versa at a 1:1 rate.
  ("hDAI", "hETH")
- **Canonical L2 Token** - The primary layer-2 representation of a Canonical L1 Token. This is the
  token you get from depositing into a rollup's Canonical Token Bridge.

## Token Path

On Hop, tokens are always converted along the following path. To convert DAI to Arbitrum DAI, DAI (on layer-1) is first converted to hDAI (on layer-2) using the layer-1 Hop Bridge. Then the hDAI is swapped for Arbitrum DAI through the Uniswap market. This can be done in one transaction by calling `sendToL2AndAttemptSwap`.

```
      Layer 1          |      Layer 2
                       |
Canonical L1 Token <---|---> hToken <--(Uniswap)--> Canonical L2 Token
                       |
```

e.g.

```
      Layer 1          |      Layer 2
                       |
DAI <--------------<---|---> hDAI <----(Uniswap)--> Arbitrum DAI
                       |
```

## Steps to Integrate a New L2

The following steps are to add a new layer-2 (Xyz, for example) to the Hop System:

- Contract updates

  - Add the Xyz messenger interface in `./contracts/interfaces/xyz/messengers/IXyz.sol`
  - Add a wrapper for the Xyz messenger in `./contracts/wrappers/XyzMessengerWrapper.sol`
  - Add messenger logic for Xyz to the L1 mock messenger in `./contracts/test/L1_MockMessenger.sol`
  - Add messenger logic for Xyz to the L2 mock messenger in `./contracts/test/L2_MockMessenger.sol`
  - Add an L2 Bridge for Xyz to `./contracts/bridges/L2_XyzBridge.sol`
  - Add a mock L2 Bridge for Xyz to `./contracts/test/Mock_L2_XyzBridge.sol`

- Testing updates

  - Add Xyz contract artifacts to `getL2SpecificArtifact()` in `./test/shared/fixtures.ts`
  - Add Xyz to `CHAIN_IDS` in `./config/constants.ts`
  - Add `getMessengerWrapperDefaults()` to `./config/utils.ts`
  - Add `isChainIdXyz()` to `./config/utils.ts`
  - Add Xyz to `sendChainSpecificBridgeDeposit()` to ./scripts/shared/utils.ts

- Config updates
  - Add the L2 and its config to `./hardhat.config.ts`

## FAQ

- How can I verify the contracts on Etherscan?

  - To do it manually:
    1. Flatten the contract with `npx hardhat flatten ./contracts/bridges/L1_Bridge.sol > flat.txt`
    2. Keep one SPDX license at the top of the file. Remove all the others.
    3. Keep one Solidity pragma and ABIEncoder definition at the top of the file. Remove all others.
    4. Verify on Etherscan.

- Why can I not interact with a contract I just deployed?

  - It takes a few blocks for transactions to traverse from L1 to other chains. If your contract was deployed on an L2 via an L1 call, you may have to wait a few blocks.

- What is the l2ethers object from hardhat?

  - It is an ethers.js object that is used when creating a contract factory for the OVM. It use OVM bytecode.

- Why are my Optimism contracts not working?

  - Optimism adds additional bytecode to your contracts when they are compiled. This may push your contract over the contract size limit. When this happens, your contract deployment mail fail silently (the transaction will succeed but there will be no code at the address). Try removing unused functions from your contracts.

- Why can I not interact with contracts on xDai?

  - Interacting with xDai contracts sends a negative default `gasLimit`. To resolve this issue, add `overrides` with a defined `gasLimit` with each contract invocation.

- Why do my Optimism contract interactions appear to work but do not update state?

  - If `overrides` are added to Optimism contract invocations, the code will say the tx has succeeded, but no state will be updated.