// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.7.3;
pragma experimental ABIEncoderV2;

import "../interfaces/polygon/messengers/I_L2_PolygonMessenger.sol";
import "../bridges/L2_PolygonMessengerProxy.sol";

contract Mock_L2_PolygonMessengerProxy is L2_PolygonMessengerProxy {

    I_L2_PolygonMessenger public messenger;

    constructor (
        address _fxChild,
        I_L2_PolygonMessenger _messenger
    )
        public
        L2_PolygonMessengerProxy(_fxChild)
    {
        messenger = _messenger;
    }

    function sendCrossDomainMessage(bytes memory message) external override onlyL2Bridge {
        messenger.syncState(fxRootTunnel, message);
    }
}