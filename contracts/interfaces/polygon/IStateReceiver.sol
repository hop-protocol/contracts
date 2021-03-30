pragma solidity 0.6.12;

interface IStateReceiver {
  function onStateReceive(uint256 stateId, bytes calldata data) external;
}
