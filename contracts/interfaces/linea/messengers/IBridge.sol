// SPDX-License-Identifier: OWNED BY ConsenSys Software Inc.
pragma solidity ^0.6.12;

/// @title The bridge interface implemented on both chains
interface IBridge {
  event MessageDispatched(
    address _from,
    address _to,
    uint256 _fee,
    uint256 _value,
    uint256 _deadline,
    bytes _calldata
  );

  event MessageDelivered(
    address _from,
    address _to,
    uint256 _fee,
    uint256 _value,
    uint256 _deadline,
    bytes _calldata
  );

  function dispatchMessage(
    address _to,
    uint256 _fee,
    uint256 _deadline,
    bytes calldata _calldata
  ) external payable;

  function deliverMessage(
    address _from,
    address _to,
    uint256 _fee,
    uint256 _value,
    uint256 _deadline,
    bytes calldata _calldata
  ) external payable;

  function sender() external view returns (address);

  // New implementation
  function sendMessage(
    address _to,
    uint256 _fee,
    bytes calldata _calldata
  ) external payable;
  function minimumFeeInWei() external view returns (uint256);
}