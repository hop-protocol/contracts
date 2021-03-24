// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../saddle/Swap.sol";
import "./L2_Bridge.sol";
import "../interfaces/IWETH.sol";

contract L2_AmmWrapper {

    L2_Bridge public bridge;
    IERC20 public l2CanonicalToken;
    bool public l2CanonicalTokenIsEth;
    IERC20 public hToken;
    Swap public exchangeAddress;

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
        bridge = _bridge;
        l2CanonicalToken = _l2CanonicalToken;
        l2CanonicalTokenIsEth = _l2CanonicalTokenIsEth;
        hToken = _hToken;
        exchangeAddress = _exchangeAddress;
    }

    /// @notice amount is the amount the user wants to send plus the Bonder fee
    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destinationAmountOutMin,
        uint256 destinationDeadline
    )
        public
        payable
    {
        require(amount >= bonderFee, "L2_BRG: Bonder fee cannot exceed amount");

        if (l2CanonicalTokenIsEth) {
            require(msg.value == amount, "L2_BRG: Value does not match amount");
            IWETH(address(l2CanonicalToken)).deposit{value: amount}();
        } else {
            require(l2CanonicalToken.transferFrom(msg.sender, address(this), amount), "L2_UW: TransferFrom failed");
        }

        require(l2CanonicalToken.approve(address(exchangeAddress), amount), "L2_UW: Approve failed");
        uint256 swapAmount = Swap(exchangeAddress).swap(
            0,
            1,
            amount,
            amountOutMin,
            deadline
        );

        bridge.send(chainId, recipient, swapAmount, bonderFee, destinationAmountOutMin, destinationDeadline);
    }

    function attemptSwap(address recipient, uint256 amount, uint256 amountOutMin, uint256 deadline) external {
        require(hToken.transferFrom(msg.sender, address(this), amount), "L2_UW: TransferFrom failed");
        require(hToken.approve(address(exchangeAddress), amount), "L2_UW: Approve failed");

        uint256 amountOut = 0;
        try Swap(exchangeAddress).swap(
            1,
            0,
            amount,
            amountOutMin,
            deadline
        ) returns (uint256 _amountOut) {
            amountOut = _amountOut;
        } catch {}

        if (amountOut == 0) {
            // Transfer hToken to recipient if swap fails
            require(hToken.transfer(recipient, amount), "L2_UW: Transfer failed");
            return;
        }

        if (l2CanonicalTokenIsEth) {
            IWETH(address(l2CanonicalToken)).withdraw(amountOut);
            (bool success, ) = recipient.call{value: amountOut}(new bytes(0));
            require(success, 'L2_UW: ETH transfer failed');
        } else {
            require(l2CanonicalToken.transfer(recipient, amountOut), "L2_UW: Transfer failed");
        }
    }
}
