// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

abstract contract L2_Connector {
    address public l1Address;
    address public l2Address;

    constructor(address _l1Address, address _l2Address) public {
        l1Address = _l1Address;
        l2Address = _l2Address;
    }

    fallback () external {
        if (msg.sender == l2Address) {
            _forwardCrossDomainMessage();
        } else {
            _verifySender();

            (bool success,) = l2Address.call(msg.data);
            require(success, "L2_CNR: Failed to forward message");
        }
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;
    function _verifySender() internal virtual;
}
