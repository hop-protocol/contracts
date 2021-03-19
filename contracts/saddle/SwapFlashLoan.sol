// SPDX-License-Identifier: MIT WITH AGPL-3.0-only

pragma solidity 0.6.12;

import "./Swap.sol";
import "./interfaces/IFlashLoanReceiver.sol";

/**
 * @title Swap - A StableSwap implementation in solidity.
 * @notice This contract is responsible for custody of closely pegged assets (eg. group of stablecoins)
 * and automatic market making system. Users become an LP (Liquidity Provider) by depositing their tokens
 * in desired ratios for an exchange of the pool token that represents their share of the pool.
 * Users can burn pool tokens and withdraw their share of token(s).
 *
 * Each time a swap between the pooled tokens happens, a set fee incurs which effectively gets
 * distributed to the LPs.
 *
 * In case of emergencies, admin can pause additional deposits, swaps, or single-asset withdraws - which
 * stops the ratio of the tokens in the pool from changing.
 * Users can always withdraw their tokens via multi-asset withdraws.
 *
 * @dev Most of the logic is stored as a library `SwapUtils` for the sake of reducing contract's
 * deployment size.
 */
contract SwapFlashLoan is Swap {
    // Total fee that is charged on all flashloans in BPS. Borrowers must repay the amount plus the flash loan fee.
    // This fee is split between the protocol and the pool.
    uint256 public flashLoanFeeBPS;
    // Share of the flash loan fee that goes to the protocol in BPS. A portion of each flash loan fee is allocated
    // to the protocol rather than the pool.
    uint256 public protocolFeeShareBPS;
    // Max BPS for limiting flash loan fee settings.
    uint256 public constant MAX_BPS = 10000;

    /*** EVENTS ***/
    event FlashLoan(
        address indexed receiver,
        uint8 tokenIndex,
        uint256 amount,
        uint256 amountFee,
        uint256 protocolFee
    );

    /**
     * @notice Initializes this Swap contract with the given parameters.
     * This will also deploy the LPToken that represents users
     * LP position. The owner of LPToken will be this contract - which means
     * only this contract is allowed to mint new tokens.
     *
     * @param _pooledTokens an array of ERC20s this pool will accept
     * @param decimals the decimals to use for each pooled token,
     * eg 8 for WBTC. Cannot be larger than POOL_PRECISION_DECIMALS
     * @param lpTokenName the long-form name of the token to be deployed
     * @param lpTokenSymbol the short symbol for the token to be deployed
     * @param _a the amplification coefficient * n * (n - 1). See the
     * StableSwap paper for details
     * @param _fee default swap fee to be initialized with
     * @param _adminFee default adminFee to be initialized with
     * @param _withdrawFee default withdrawFee to be initialized with
     */
    function initialize(
        IERC20[] memory _pooledTokens,
        uint8[] memory decimals,
        string memory lpTokenName,
        string memory lpTokenSymbol,
        uint256 _a,
        uint256 _fee,
        uint256 _adminFee,
        uint256 _withdrawFee
    ) public virtual override initializer {
        Swap.initialize(
            _pooledTokens,
            decimals,
            lpTokenName,
            lpTokenSymbol,
            _a,
            _fee,
            _adminFee,
            _withdrawFee
        );
        flashLoanFeeBPS = 100; // 100bps
        protocolFeeShareBPS = 5000; // 5000bps
    }

    /*** STATE MODIFYING FUNCTIONS ***/

    /**
     * @notice Borrow the specified token from this pool for this transaction only. This function will call
     * `IFlashLoanReceiver(receiver).executeOperation` and the `receiver` must return the full amount of the token
     * and the associated fee by the end of the callback transaction. If the conditions are not met, this call
     * is reverted.
     * @param receiver the address of the receiver of the token. This address must implement the IFlashLoanReceiver
     * interface and the callback function `executeOperation`.
     * @param token the protocol fee in bps to be applied on the total flash loan fee
     * @param amount the total amount to borrow in this transaction
     * @param params optional data to pass along to the callback function
     */
    function flashLoan(
        address receiver,
        IERC20 token,
        uint256 amount,
        bytes memory params
    ) external nonReentrant {
        uint8 tokenIndex = getTokenIndex(address(token));
        uint256 availableLiquidityBefore = token.balanceOf(address(this));
        uint256 protocolBalanceBefore =
            availableLiquidityBefore.sub(swapStorage.balances[tokenIndex]);
        require(
            amount > 0 && availableLiquidityBefore >= amount,
            "invalid amount"
        );

        // Calculate the additional amount of tokens the pool should end up with
        uint256 amountFee = amount.mul(flashLoanFeeBPS).div(10000);
        // Calculate the portion of the fee that will go to the protocol
        uint256 protocolFee = amountFee.mul(protocolFeeShareBPS).div(10000);
        require(amountFee > 0, "amount is small for a flashLoan");

        // Transfer the requested amount of tokens
        token.safeTransfer(receiver, amount);

        // Execute callback function on receiver
        IFlashLoanReceiver(receiver).executeOperation(
            address(this),
            address(token),
            amount,
            amountFee,
            params
        );

        uint256 availableLiquidityAfter =
            token.balanceOf(address(this)).sub(protocolBalanceBefore);
        require(
            availableLiquidityAfter >= availableLiquidityBefore.add(amountFee),
            "flashLoan fee is not met"
        );

        swapStorage.balances[tokenIndex] = availableLiquidityAfter.sub(
            protocolFee
        );
        emit FlashLoan(receiver, tokenIndex, amount, amountFee, protocolFee);
    }

    /*** ADMIN FUNCTIONS ***/

    /**
     * @notice Updates the flash loan fee parameters. This function can only be called by the owner.
     * @param newFlashLoanFeeBPS the total fee in bps to be applied on future flash loans
     * @param newProtocolFeeShareBPS the protocol fee in bps to be applied on the total flash loan fee
     */
    function setFlashLoanFees(
        uint256 newFlashLoanFeeBPS,
        uint256 newProtocolFeeShareBPS
    ) external onlyOwner {
        require(
            newFlashLoanFeeBPS > 0 &&
                newFlashLoanFeeBPS <= MAX_BPS &&
                newProtocolFeeShareBPS <= MAX_BPS,
            "fees are not in valid range"
        );
        flashLoanFeeBPS = newFlashLoanFeeBPS;
        protocolFeeShareBPS = newProtocolFeeShareBPS;
    }
}
