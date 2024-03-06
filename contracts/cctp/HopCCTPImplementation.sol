// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

interface ICCTP {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 _nonce);
}

contract HopCCTPImplementation {
    using SafeERC20 for IERC20;

    IERC20 public immutable nativeToken;
    IERC20 public immutable bridgedToken;
    IAMM public immutable amm;
    ICCTP public immutable cctp;
    address public immutable feeCollector;
    uint256 public immutable minBonderFee;
    mapping(uint256 => bool) public activeChainIds;
    mapping(uint256 => uint32) public destinationDomains;

    event CCTPTransferSent(
        uint64 indexed cctpNonce,
        uint256 indexed chainId,
        address indexed recipient,
        uint256 amount,
        uint256 bonderFee
    );

    constructor(
        address nativeTokenAddress,
        address bridgedTokenAddress,
        address ammAddress,
        address cctpAddress,
        address _feeCollector,
        uint256 _minBonderFee,
        uint256[] memory chainIds,
        uint32[] memory domains
    ) {
        nativeToken = IERC20(nativeTokenAddress);
        bridgedToken = IERC20(bridgedTokenAddress);
        amm = IAMM(ammAddress);
        cctp = ICCTP(cctpAddress);
        feeCollector = _feeCollector;
        minBonderFee = _minBonderFee;
        for (uint256 i = 0; i < chainIds.length; i++) {
            activeChainIds[chainIds[i]] = true;
            destinationDomains[chainIds[i]] = domains[i];
        }

        nativeToken.approve(address(cctp), type(uint256).max);
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

    // @notice amount is the total amount the user wants to send including the bonderFee
    function send(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee
    )
        external
    {
        nativeToken.safeTransferFrom(msg.sender, address(this), amount);
        _send(chainId, recipient, amount, bonderFee);
    }

    function _send(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee
    )
        internal
    {
        require(amount > 0, "HOP_CCTP: Bonder fee cannot exceed amount");
        require(amount > bonderFee, "HOP_CCTP: Bonder fee cannot exceed amount");
        require(bonderFee >= minBonderFee, "HOP_CCTP: Min bonder fee required");
        require(activeChainIds[chainId], "HOP_CCTP: Cannot send to unsupported chainId");
        require(chainId != block.chainid, "HOP_CCTP: Cannot send to the same chain");

        nativeToken.safeTransferFrom(address(this), feeCollector, bonderFee);

        uint256 amountAfterFee = amount - bonderFee;
        uint64 cctpNonce = cctp.depositForBurn(
            amountAfterFee,
            destinationDomains[chainId],
            bytes32(uint256(uint160(recipient))),
            address(nativeToken)
        );

        emit CCTPTransferSent(
            cctpNonce,
            chainId,
            recipient,
            amount,
            bonderFee
        );
    }
}