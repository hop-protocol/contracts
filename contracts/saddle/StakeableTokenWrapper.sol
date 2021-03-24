// SPDX-License-Identifier: MIT

// Generalized and adapted from https://github.com/k06a/Unipool 🙇

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title StakeableTokenWrapper
 * @notice A wrapper for an ERC-20 that can be staked and withdrawn.
 * @dev In this contract, staked tokens don't do anything- instead other
 * contracts can inherit from this one to add functionality.
 */
contract StakeableTokenWrapper {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public totalSupply;
    IERC20 public stakedToken;
    mapping(address => uint256) private _balances;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Creates a new StakeableTokenWrapper with given `_stakedToken` address
     * @param _stakedToken address of a token that will be used to stake
     */
    constructor(IERC20 _stakedToken) public {
        stakedToken = _stakedToken;
    }

    /**
     * @notice Read how much `account` has staked in this contract
     * @param account address of an account
     * @return amount of total staked ERC20(this.stakedToken) by `account`
     */
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /**
     * @notice Stakes given `amount` in this contract
     * @param amount amount of ERC20(this.stakedToken) to stake
     */
    function stake(uint256 amount) external {
        require(amount != 0, "amount == 0");
        totalSupply = totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakedToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Withdraws given `amount` from this contract
     * @param amount amount of ERC20(this.stakedToken) to withdraw
     */
    function withdraw(uint256 amount) external {
        totalSupply = totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakedToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}
