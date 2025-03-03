// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../saddle/Swap.sol";
import "./L2_Bridge.sol";
import "../interfaces/IWETH.sol";
import "./SwapDataConsumer.sol";

contract L2_AmmWrapper is SwapDataConsumer {
    using SafeERC20 for IERC20;

    L2_Bridge public immutable bridge;
    IERC20 public immutable l2CanonicalToken;
    bool public immutable l2CanonicalTokenIsEth;
    IERC20 public immutable hToken;
    Swap public immutable exchangeAddress;

    /// @notice When l2CanonicalTokenIsEth is true, l2CanonicalToken should be set to the WETH address
    constructor(
        L2_Bridge _bridge,
        IERC20 _l2CanonicalToken,
        bool _l2CanonicalTokenIsEth,
        IERC20 _hToken,
        Swap _exchangeAddress
    )
        public
    {
        require(_bridge != L2_Bridge(0), "L2_AMM_W: Cannot set bridge to zero address");
        require(_l2CanonicalToken != IERC20(0), "L2_AMM_W: Cannot set l2CanonicalToken to zero address");
        require(_hToken != IERC20(0), "L2_AMM_W: Cannot set hToken to zero address");
        require(_exchangeAddress != Swap(0), "L2_AMM_W: Cannot set exchangeAddress to zero address");

        bridge = _bridge;
        l2CanonicalToken = _l2CanonicalToken;
        l2CanonicalTokenIsEth = _l2CanonicalTokenIsEth;
        hToken = _hToken;
        exchangeAddress = _exchangeAddress;
    }

    receive() external payable {}

    /// @notice amount is the amount the user wants to send plus the Bonder fee
    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        SwapData memory swapData,
        SwapData memory destinationSwapData,
        address bonder
    )
        public
        payable
    {
        require(amount >= bonderFee, "L2_AMM_W: Bonder fee cannot exceed amount");
        require(recipient != address(0), "L2_AMM_W: Recipient cannot be zero address");
        require(bonder != address(0), "L2_AMM_W: Bonder cannot be zero address");

        if (l2CanonicalTokenIsEth) {
            require(msg.value == amount, "L2_AMM_W: Value does not match amount");
            IWETH(address(l2CanonicalToken)).deposit{value: amount}();
        } else {
            l2CanonicalToken.safeTransferFrom(msg.sender, address(this), amount);
        }

        l2CanonicalToken.safeApprove(address(exchangeAddress), amount);
        uint256 swapAmount = Swap(exchangeAddress).swap(
            swapData.tokenIndex,
            0,
            amount,
            swapData.amountOutMin,
            swapData.deadline
        );

        bridge.send(
            chainId,
            recipient,
            swapAmount,
            bonderFee,
            destinationSwapData,
            bonder
        );
    }

    function attemptSwap(
        address recipient,
        uint256 amount,
        SwapData calldata swapData
    )
        external
    {
        require(recipient != address(0), "L2_AMM_W: Recipient cannot be zero address");

        hToken.safeTransferFrom(msg.sender, address(this), amount);
        hToken.safeApprove(address(exchangeAddress), amount);

        uint256 amountOut = 0;
        try Swap(exchangeAddress).swap(
            0,
            swapData.tokenIndex,
            amount,
            swapData.amountOutMin,
            swapData.deadline
        ) returns (uint256 _amountOut) {
            amountOut = _amountOut;
        } catch {}

        if (amountOut == 0) {
            // Transfer hToken to recipient if swap fails
            hToken.safeTransfer(recipient, amount);
            return;
        }

        if (l2CanonicalTokenIsEth) {
            IWETH(address(l2CanonicalToken)).withdraw(amountOut);
            (bool success, ) = recipient.call{value: amountOut}(new bytes(0));
            require(success, 'L2_AMM_W: ETH transfer failed');
        } else {
            l2CanonicalToken.safeTransfer(recipient, amountOut);
        }
    }
}
