// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

abstract contract Connector {
    address public localAddress;
    address public xDomainConnector;

    constructor(address _localAddress) public {
        require(_localAddress != address(0), "CNR: localAddress cannot be zero address");
        localAddress = _localAddress;
    }

    fallback () external payable {
        if (msg.sender == localAddress) {
            _forwardCrossDomainMessage();
        } else {
            _verifySender();

            (bool success,) = localAddress.call(msg.data);
            require(success, "CNR: Failed to forward message");
        }
    }

    /**
     * @dev Sets the l2BridgeConnectorAddress
     * @param _xDomainConnector The new bridge connector address
     */
    function setxDomainConnector(address _xDomainConnector) external {
        require(_xDomainConnector != address(0), "CNR: Cannot set xDomainConnector to zero address");
        require(xDomainConnector == address(0), "CNR: xDomainConnector has already been set");
        xDomainConnector = _xDomainConnector;
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;
    function _verifySender() internal virtual;
}
