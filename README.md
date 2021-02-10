# `contracts`

The smart contracts that power the Hop Exchange.

## Protocol Design

_For a detailed description of the protocol, please see the [whitepaper](https://hop.exchange/whitepaper.pdf)._

### Overview

The Hop protocol provides a scalable rollup-to-rollup General Token Bridge using a two-pronged approach:

1. Create a cross-network bridge token that can be quickly and economically moved from rollup to rollup or claimed on layer-1 for its underlying asset.
2. Use Automated Market Makers to swap between each bridge token and its corresponding Canonical Tokens on each rollup in order to dynamically price liquidity and incentivize the rebalancing of liquidity across the network.

The combined approach allows users to quickly and trustlessly swap between layer-2 Canonical Tokens using the specialized bridge token as an intermediary asset.

A bonder posts their funds as collateral for the system, which effectively fronts liquidity for users to easily transfer throughout each layer. All transferred funds are tracked and and the system will always have funds that account for all assets within the Hop ecosystem. Transfers are fully settled and bonders credits restored when the canonical L2 checkpoints their state onto L1.

Invalid transfers can be challenged by anyone. Challenges require a challenged to put up stake and wait until the challenged transfer is fully settled. If the challenge is won, the challenger is paid out their initial stake plus some. If it is lost, the challenge stake gets credited to the system.

### Contracts

#### Bridges

**Accounting.sol**: Abstract contract that is responsible for the accounting of the L1 and L2 bridges. A bonder can stake or unstake their funds using functions in this contract. All credits and debits are accounted accounted for and updated in this contract.

**Bridge.sol**: Abstract contract that inherits `Accounting.sol` and has the base, shared functionality for `L1_Bridge.sol` and `L2_Bridge.sol`. This contract's main functionality is to handle user withdrawals on any chain. It is also responsible for settling withdrawals and updating a bonder's credit. This contract has helper functions to retrieve data related to transfers.

**L1_BridgeConfig.sol**: This contract contains getters and setters for L1_Bridge related variables. Most of these variables are associated with challenges.

**L1_Bridge.sol**: This contract inherits `Bridge.sol` and `L1_BridgeConfig.sol`. There are four main entities that will use this contract and four main functionalities within it. A **user** can use this contract to send tokens to an L2. A **bonder** can use this contract to bond transfer roots. An **off-chain node** will use this contract to confirm transfer roots. **Anyone** can challenge and resolve a transfer bond.

**L2_Bridge.sol**: This abstract contract inherits `Bridge.sol` and `ERC20.sol`. Similar to `L1_Bridge.sol`, there are four entities that will use this contract with four main functionalities within in. A **user** can use this contract to send tokens to either an L1 or an L2. They can also withdraw their tokens on an L2 through this contract. A **bonder** can bond a withdrawal on behalf of a user. An **off-chain node** will use this contract to mint new H Tokens. The **governance** entity can set various parameters.

This contract is also an ERC20 contract that represents as an h token. Each mainnet token is represented 1:1 by an h token (e.g., 1 mainnet DAI has a corresponding hDAI). This bridge handles the minting/burning, transfers, and all ERC20 related functionality of these h tokens.

**L2_ArbitrumBridge.sol / L2_OptimismBridge.sol**: These contracts inherit `L2_Bridge.sol` and add L2 specific implementation details. These are the contracts that will be deployed on each L2.

### Definitions

- **Transfer** - The data for a transfer from one chain to another.
- **TransferHash** - The hash of a single transfer's data.
- **TransferRoot** - The merkle root of a tree of TransferHashes and associated metadata such as the destination chainIds and totals for each chain.
- **Bridge** - A hop bridge contracts on L1 or L2 ("L1 Bridge", "Hop Bridge", "Arbitrum Bridge", "Optimism Bridge")
- **Canonical Token Bridge** - A Rollup's own token bridge. ("Canonical Arbitrum Bridge", "Canonical Optimism Bridge")
- **Challenge** - A staked claim that a transfer is invalid. Anyone can challenge a transfer and will be rewarded or punished accordingly.
- **h Tokens** - Hop Bridge Tokens (e.g., ”Hop ETH”, ”Hop DAI” with symbols ”hETH”, ”hDAI” respectively) are specialized layer-2 tokens that can be transferred rollup-to-rollup in batches and act as intermediary assets in the Hop protocol.

### Diagrams

- For detailed diagrams of the system, please see [here](https://github.com/hop-exchange/contracts/tree/master/assets)
  - [Detailed Transaction Diagrams](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Contract_Inheritance_Diagram.jpg)
  - [Contract Inheritance](https://github.com/hop-exchange/contracts/blob/master/assets/Hop_Transfer_Diagrams.jpg)

## Contract Addresses

Please see [`./config/addresses.ts`](https://github.com/hop-exchange/contracts/blob/master/config/addresses.ts) for all deployed contract addresses.

### Tokens

- **Canonical L1 Token** - The layer 1 token that is being bridged.
  ("Canonical L1 ETH", "Canonical L1 DAI", "DAI", "ETH")
- **hToken** - Exists on L2 and represents the right to 1 Token deposited in the L1 bridge.
  hToken's can be converted to their Canonical L1 Token or vice versa at a 1:1 rate.
  ("hDAI", "hETH")
- **Canonical L2 Token** - The primary L2 representation of a Canonical L1 Token. This is the
  token you get from depositing into a rollup's Canonical Token Bridge.

### Token Path

On Hop, tokens are always converted along the following path. To convert DAI to Arbitrum DAI, DAI (on L1) is first converted to hDAI (on L2) using the L1 Hop Bridge. Then the hDAI is swapped for Arbitrum DAI through the Uniswap market. This can be done in one transaction by calling `sendToL2AndAttemptSwap`.

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

The following steps are to add a new L2 (Xyz, for example) to the Hop System:

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
