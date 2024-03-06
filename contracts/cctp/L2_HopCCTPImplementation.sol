// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./HopCCTPImplementation.sol";

interface IAMM {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(
        ExactInputParams memory params
    ) external returns (uint256 amountOut);
}

contract L2_HopCCTPImplementation is HopCCTPImplementation {
    using SafeERC20 for IERC20;

    IERC20 public immutable bridgedToken;
    IAMM public immutable amm;

    constructor(
        address nativeTokenAddress,
        address cctpAddress,
        address feeCollectorAddress,
        uint256 minBonderFee,
        uint256[] memory chainIds,
        uint32[] memory domains,
        address bridgedTokenAddress,
        address ammAddress
    ) HopCCTPImplementation(
        nativeTokenAddress,
        cctpAddress,
        feeCollectorAddress,
        minBonderFee,
        chainIds,
        domains
    ) {
        bridgedToken = IERC20(bridgedTokenAddress);
        amm = IAMM(ammAddress);
        bridgedToken.approve(address(amm), type(uint256).max);
    }

    /**
     * @dev Swap param validation ensures the caller must spend the bridged token and can only 
     * receive the native token for sending. This contract is unconcerned with the actual path
     * used as long as the first and last tokens are known.
     *
     * @dev Path encoding for single pool: tokenAddress - fee - tokenAddress
     * @dev Path encoding for multi pools: tokenAddress - fee - tokenAddress - fee - ... - tokenAddress
     *
     * @notice amount is the total amount the user wants to send including the bonderFee
     */
    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        IAMM.ExactInputParams calldata swapParams
    )
        external
    {
        require(amount > 0, "HOP_CCTP: swapAndSend amount cannot be 0");
        bridgedToken.safeTransferFrom(msg.sender, address(this), amount);

        // Validate swap params
        address firstTokenAddressInPath = address(uint160(bytes20(swapParams.path[:20])));
        address lastTokenAddressInPath = address(uint160(bytes20(swapParams.path[swapParams.path.length - 20:])));
        require(address(bridgedToken) == firstTokenAddressInPath, "HOP_CCTP: Path must start with the bridged token address");
        require(address(nativeToken) == lastTokenAddressInPath, "HOP_CCTP: Path must end with the native token address");
        require(address(this) == swapParams.recipient, "HOP_CCTP: Send recipient must be this contract");
        require(amount == swapParams.amountIn, "HOP_CCTP: Send amount does not match swap amount");

        uint256 swapAmount = amm.exactInput(swapParams);
        _send(chainId, recipient, swapAmount, bonderFee);
    }
}