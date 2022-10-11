// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L1_ERC20_Bridge.sol";

/**
 * @dev A L1_Bridge that uses HOP as the canonical token
 */

contract L1_HOP_Bridge is L1_ERC20_Bridge {

    address public migrator;

    modifier onlyMigrator () {
        require(msg.sender == migrator, "L1_HOP_BRG: Caller is not the migrator");
        _;
    }

    constructor (
        IERC20 _l1CanonicalToken,
        address[] memory bonders,
        address _governance,
        address _migrator
    )
        public
        L1_ERC20_Bridge(_l1CanonicalToken, bonders, _governance)
    {
        migrator = _migrator;
    }

    function migrateTokens(address recipient) external onlyMigrator {
        uint256 amount = l1CanonicalToken.balanceOf(address(this));
        _transferFromBridge(recipient, amount);
    }

    function setMigrator(address _newMigrator) external onlyMigrator {
        migrator = _newMigrator;
    }
}
