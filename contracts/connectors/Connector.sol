// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/ExecutorLib.sol";
import "../shared/Initializable.sol";

abstract contract Connector is Initializable {
    using ExecutorLib for address;

    address public target;
    address public counterpart;

    /// @dev initialize to keep creation code consistent for create2 deployments
    function initialize(address _target, address _counterpart) public initializer {
        require(_target != address(0), "CNR: Target cannot be zero address");
        require(_counterpart != address(0), "CNR: Counterpart cannot be zero address");

        target = _target;
        counterpart = _counterpart;
    }

    fallback () external payable {
        if (msg.sender == target) {
            _forwardCrossDomainMessage();
        } else {
            _verifyCrossDomainSender();
            target.execute(msg.data, msg.value);
        }
    }

    receive () external payable {
        revert("Do not send ETH to this contract");
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;

    function _verifyCrossDomainSender() internal virtual;
}