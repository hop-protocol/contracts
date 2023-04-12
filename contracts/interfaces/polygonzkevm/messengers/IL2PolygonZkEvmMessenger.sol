//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

/// @title The bridge interface implemented on both chains
interface IL2PolygonZkEvmMessenger {
  function bridgeMessage(
      uint32 destinationNetwork,
      address destinationAddress,
      bool forceUpdateGlobalExitRoot,
      bytes calldata metadata
  ) external payable;
}
