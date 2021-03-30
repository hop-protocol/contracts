pragma solidity 0.6.12;

interface IStateSender {
  function syncState(address receiver, bytes calldata data) external;
  function register(address sender, address receiver) external;
}