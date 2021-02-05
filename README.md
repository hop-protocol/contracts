# `contracts`

The smart contracts that power the Hop Exchange.

## Contract Addresses

Please see [`./config/addresses.ts`](https://github.com/hop-exchange/contracts/blob/master/config/addresses.ts) for all deployed contract addresses.

## Definitions

- **Transfer** - The data for a transfer from one chain to another.
- **TransferHash** - The hash of a single transfer's data.
- **TransferRoot** - The merkle root of a tree of TransferHashes and associated metadata such as the destination chainIds and totals for each chain.
- **Bridge** - A hop bridge contracts on L1 or L2 ("L1 Bridge", "Hop Bridge", "Arbitrum Bridge", "Optimism Bridge")
- **Canonical Token Bridge** - A Rollup's own token bridge. ("Canonical Arbitrum Bridge", "Canonical Optimism Bridge")

#### Tokens

- **Canonical L1 Token** - The layer 1 token that is being bridged.
  ("Canonical L1 ETH", "Canonical L1 DAI", "DAI", "ETH")
- **hToken** - Exists on L2 and represents the right to 1 Token deposited in the L1 bridge.
  hToken's can be converted to their Canonical L1 Token or vice versa at a 1:1 rate.
  ("hDAI", "hETH")
- **Canonical L2 Token** - The primary L2 representation of a Canonical L1 Token. This is the
  token you get from depositing into a rollup's Canonical Token Bridge.

#### Token Path

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
