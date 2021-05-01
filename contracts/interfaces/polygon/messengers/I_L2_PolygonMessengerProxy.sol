pragma solidity ^0.6.0;

interface I_L2_PolygonMessengerProxy {
    function processMessageFromRoot(
        bytes calldata message
    ) external;
}