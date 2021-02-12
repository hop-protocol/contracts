// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @dev Accounting is an abstract contract that encapsulates the most critical logic in the Hop system.
 * The accounting system works by using two balances that can only increase `credit` and `debit`.
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

    mapping(address => bool) private isBonder;

    mapping(address => uint256) private credit;
    mapping(address => uint256) private debit;

    event Stake (
        uint256 amount
    );

    event Unstake (
        uint256 amount
    );

    /* ========== Modifiers ========== */

    modifier onlyBonder {
        require(isBonder[msg.sender], "ACT: Caller is not bonder");
        _;
    }

    /// @dev Used by parent contract to ensure that the bonder is solvent at the end of the transaction.
    modifier requirePositiveBalance {
        _;
        require(getCredit(msg.sender) >= getDebitAndAdditionalDebit(msg.sender), "ACT: Not enough available credit");
    }

    /// @dev Sets the bonder addresses
    constructor(address[] memory _bonders) public {
        for (uint256 i = 0; i < _bonders.length; i++) {
            isBonder[_bonders[i]] = true;
        }
    }

    /* ========== Virtual functions ========== */

    function _transferFromBridge(address _recipient, uint256 _amount) internal virtual;
    function _transferToBridge(address _from, uint256 _amount) internal virtual;

    /**
     * @dev This function can be optionally overridden by a parent contract to track any additional
     * debit balance in an alternative way.
     */
    function _additionalDebit() internal view virtual returns (uint256) {
        this; // Silence state mutability warning without generating any additional byte code
        return 0;
    }

    /* ========== Public getters ========== */

    function getIsBonder(address _maybeBonder) public view returns (bool) {
        return isBonder[_maybeBonder];
    }

    function getCredit(address _bonder) public view returns (uint256) {
        return credit[_bonder];
    }

    function getDebitAndAdditionalDebit(address _bonder) public view returns (uint256) {
        return debit[_bonder].add(_additionalDebit());
    }

    /* ========== Bonder public functions ========== */

    /** 
     * @dev Allows the bonder to deposit tokens and increase its credit balance
     * @param _amount The amount being staked
     */
    function stake(address _bonder, uint256 _amount) external {
        _transferToBridge(msg.sender, _amount);
        _addCredit(_bonder, _amount);
    }

    /**
     * @dev Allows the bonder to withdraw any available balance and add to its debit balance
     * @param _amount The amount being staked
     */
    function unstake(uint256 _amount) external requirePositiveBalance onlyBonder {
        _addDebit(msg.sender, _amount);
        _transferFromBridge(msg.sender, _amount);
    }

    /* ========== Internal functions ========== */

    function _addCredit(address bonder, uint256 _amount) internal {
        credit[bonder] = credit[bonder].add(_amount);
    }

    function _addDebit(address bonder, uint256 _amount) internal {
        debit[bonder] = debit[bonder].add(_amount);
    }
}
