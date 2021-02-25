// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @dev Accounting is an abstract contract that encapsulates the most critical logic in the Hop system.
 * The accounting system works by using two balances that can only increase `_credit` and `_debit`.
 * A bonder's available balance is the total credit minus the total debit. The contract exposes
 * two external functions that allows a bonder to stake and unstake and exposes two internal
 * functions to its parent contracts that allow the parent contract to add to the credit 
 * and debit balance. In addition, parent contracts can override `_additionalDebit` to account
 * for any additional debit balance in an alternative way. Lastly, it exposes a modifier,
 * `requirePositiveBalance`, that can be used by parent contracts to ensure the bonder does not
 * use more than its available stake.
 */

abstract contract Accounting {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => bool) private _isBonder;

    mapping(address => uint256) private _credit;
    mapping(address => uint256) private _debit;

    event Stake (
        uint256 amount
    );

    event Unstake (
        uint256 amount
    );

    /* ========== Modifiers ========== */

    modifier onlyBonder {
        require(_isBonder[msg.sender], "ACT: Caller is not bonder");
        _;
    }

    modifier onlyGovernance {
        _requireIsGovernance();
        _;
    }

    /// @dev Used by parent contract to ensure that the bonder is solvent at the end of the transaction.
    modifier requirePositiveBalance {
        _;
        require(getCredit(msg.sender) >= getDebitAndAdditionalDebit(msg.sender), "ACT: Not enough available credit");
    }

    /// @dev Sets the bonder addresses
    constructor(address[] memory bonders) public {
        for (uint256 i = 0; i < bonders.length; i++) {
            _isBonder[bonders[i]] = true;
        }
    }

    /* ========== Virtual functions ========== */
    /**
     * @dev The following functions are overridden in L1_Bridge and L2_Bridge
     */
    function _transferFromBridge(address recipient, uint256 amount) internal virtual;
    function _transferToBridge(address from, uint256 amount) internal virtual;
    function _requireIsGovernance() internal virtual;

    /**
     * @dev This function can be optionally overridden by a parent contract to track any additional
     * debit balance in an alternative way.
     */
    function _additionalDebit() internal view virtual returns (uint256) {
        this; // Silence state mutability warning without generating any additional byte code
        return 0;
    }

    /* ========== Public getters ========== */

    function getIsBonder(address maybeBonder) public view returns (bool) {
        return _isBonder[maybeBonder];
    }

    function getCredit(address bonder) public view returns (uint256) {
        return _credit[bonder];
    }

    function getDebitAndAdditionalDebit(address bonder) public view returns (uint256) {
        return _debit[bonder].add(_additionalDebit());
    }

    /* ========== Bonder public functions ========== */

    /** 
     * @dev Allows the bonder to deposit tokens and increase its credit balance
     * @param amount The amount being staked
     */
    function stake(address bonder, uint256 amount) external {
        _transferToBridge(msg.sender, amount);
        _addCredit(bonder, amount);
    }

    /**
     * @dev Allows the bonder to withdraw any available balance and add to its debit balance
     * @param amount The amount being staked
     */
    function unstake(uint256 amount) external requirePositiveBalance onlyBonder {
        _addDebit(msg.sender, amount);
        _transferFromBridge(msg.sender, amount);
    }

    function addBonder(address bonder) external onlyGovernance {
        require(_isBonder[bonder] == false, "ACT: Address is already Bonder");
        _isBonder[bonder] = true;
    }

    function removeBonder(address bonder) external onlyGovernance {
        require(_isBonder[bonder] == true, "ACT: Address is Bonder");
        _isBonder[bonder] = false;
    }

    /* ========== Internal functions ========== */

    function _addCredit(address bonder, uint256 amount) internal {
        _credit[bonder] = _credit[bonder].add(amount);
    }

    function _addDebit(address bonder, uint256 amount) internal {
        _debit[bonder] = _debit[bonder].add(amount);
    }
}
