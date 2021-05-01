pragma solidity ^0.6.0;

interface IPolygonMessengerWrapper {
    function processMessageFromChild(
        bytes calldata message
    ) external;
}