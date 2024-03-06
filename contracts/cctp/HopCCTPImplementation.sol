// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICCTP {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 _nonce);
}

abstract contract HopCCTPImplementation {
    using SafeERC20 for IERC20;

    IERC20 public immutable nativeToken;
    ICCTP public immutable cctp;
    address public immutable feeCollectorAddress;
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
        address cctpAddress,
        address _feeCollectorAddress,
        uint256 _minBonderFee,
        uint256[] memory chainIds,
        uint32[] memory domains
    ) {
        nativeToken = IERC20(nativeTokenAddress);
        cctp = ICCTP(cctpAddress);
        feeCollectorAddress = _feeCollectorAddress;
        minBonderFee = _minBonderFee;
        for (uint256 i = 0; i < chainIds.length; i++) {
            require(chainIds[i] != block.chainid, "HOP_CCTP: Cannot activate this chain");
            activeChainIds[chainIds[i]] = true;
            destinationDomains[chainIds[i]] = domains[i];
        }

        nativeToken.approve(address(cctp), type(uint256).max);
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

        nativeToken.safeTransfer(feeCollectorAddress, bonderFee);

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