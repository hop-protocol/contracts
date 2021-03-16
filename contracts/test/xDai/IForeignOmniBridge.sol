pragma solidity ^0.7.0;

interface IERC20 {}
interface IERC677 is IERC20 {}

contract IForeignOmniBridge {
    function relayTokens(IERC677 _receiver, uint256 _value) external {}
}
