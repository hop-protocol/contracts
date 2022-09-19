// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./L1_Bridge.sol";

/**
 * @dev A L1_Bridge that uses HOP as the canonical token
 */

contract L1_HOP_Bridge is L1_Bridge {
    using SafeERC20 for IERC20;

    IERC20 public immutable l1CanonicalToken;
    address public immutable hopDao;

    modifier onlyDao() {
        require(msg.sender == hopDao, "L1_HOP_BRG: Caller is not the DAO");
        _;
    }

    constructor (IERC20 _l1CanonicalToken, address[] memory bonders, address _governance, address _hopDao) public L1_Bridge(bonders, _governance) {
        l1CanonicalToken = _l1CanonicalToken;
        hopDao = _hopDao;
    }

    function migrateTokens(address recipient) external onlyDao {
        uint256 amount = l1CanonicalToken.balanceOf(address(this));
        _transferFromBridge(recipient, amount);
    }

    /* ========== Override Functions ========== */

    function _transferFromBridge(address recipient, uint256 amount) internal override {
        l1CanonicalToken.safeTransfer(recipient, amount);
    }

    function _transferToBridge(address from, uint256 amount) internal override {
        l1CanonicalToken.safeTransferFrom(from, address(this), amount);
    }
}
