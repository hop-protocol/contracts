// SPDX-License-Identifier: MIT
// https://etherscan.io/address/0xC28DF698475dEC994BE00C9C9D8658A548e6304F#code

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/ISwapGuarded.sol";

/**
 * @title Liquidity Provider Token
 * @notice This token is an ERC20 detailed token with added capability to be minted by the owner.
 * It is used to represent user's shares when providing liquidity to swap contracts.
 */
contract LPTokenGuarded is ERC20Burnable, Ownable {
    using SafeMath for uint256;

    // Address of the swap contract that owns this LP token. When a user adds liquidity to the swap contract,
    // they receive a proportionate amount of this LPToken.
    ISwapGuarded public swap;

    // Maps user account to total number of LPToken minted by them. Used to limit minting during guarded release phase
    mapping(address => uint256) public mintedAmounts;

    /**
     * @notice Deploys LPToken contract with given name, symbol, and decimals
     * @dev the caller of this constructor will become the owner of this contract
     * @param name_ name of this token
     * @param symbol_ symbol of this token
     * @param decimals_ number of decimals this token will be based on
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) public ERC20(name_, symbol_) {
        _setupDecimals(decimals_);
        swap = ISwapGuarded(_msgSender());
    }

    /**
     * @notice Mints the given amount of LPToken to the recipient. During the guarded release phase, the total supply
     * and the maximum number of the tokens that a single account can mint are limited.
     * @dev only owner can call this mint function
     * @param recipient address of account to receive the tokens
     * @param amount amount of tokens to mint
     * @param merkleProof the bytes32 array data that is used to prove recipient's address exists in the merkle tree
     * stored in the allowlist contract. If the pool is not guarded, this parameter is ignored.
     */
    function mint(
        address recipient,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external onlyOwner {
        require(amount != 0, "amount == 0");

        // If the pool is in the guarded launch phase, the following checks are done to restrict deposits.
        //   1. Check if the given merkleProof corresponds to the recipient's address in the merkle tree stored in the
        //      allowlist contract. If the account has been already verified, merkleProof is ignored.
        //   2. Limit the total number of this LPToken minted to recipient as defined by the allowlist contract.
        //   3. Limit the total supply of this LPToken as defined by the allowlist contract.
        if (swap.isGuarded()) {
            IAllowlist allowlist = swap.getAllowlist();
            require(
                allowlist.verifyAddress(recipient, merkleProof),
                "Invalid merkle proof"
            );
            uint256 totalMinted = mintedAmounts[recipient].add(amount);
            require(
                totalMinted <= allowlist.getPoolAccountLimit(address(swap)),
                "account deposit limit"
            );
            require(
                totalSupply().add(amount) <=
                    allowlist.getPoolCap(address(swap)),
                "pool total supply limit"
            );
            mintedAmounts[recipient] = totalMinted;
        }
        _mint(recipient, amount);
    }

    /**
     * @dev Overrides ERC20._beforeTokenTransfer() which get called on every transfers including
     * minting and burning. This ensures that swap.updateUserWithdrawFees are called everytime.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
        swap.updateUserWithdrawFee(to, amount);
    }
}
