// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Bridge.sol";
import "./HopBridgeToken.sol";
import "../libraries/MerkleUtils.sol";
import "../interfaces/IWETH.sol";

abstract contract L2_Bridge is Bridge {
    using SafeERC20 for IERC20;

    address public l1Governance;
    HopBridgeToken public hToken;
    address public l1BridgeAddress;
    address public exchangeAddress;
    IERC20 public l2CanonicalToken;
    bool public l2CanonicalTokenIsEth;
    mapping(uint256 => bool) public supportedChainIds;
    uint256 public minimumForceCommitDelay = 4 hours;
    uint256 public messengerGasLimit = 250000;
    uint256 public maxPendingTransfers = 100;

    mapping(uint256 => bytes32[]) public pendingTransferIdsForChainId;
    mapping(uint256 => uint256) public pendingAmountForChainId;
    mapping(uint256 => uint256) public lastCommitTimeForChainId;
    uint256 public transferNonceIncrementer;

    //keccak256("L2_Bridge v1.0");
    bytes32 private constant NONCE_DOMAIN_SEPARATOR = 0xcd24e8e9844849186ed93126ac365bc3a49362579aee585431811ea50bd1694c;

    event TransfersCommitted (
        bytes32 indexed rootHash,
        uint256 totalAmount
    );

    event TransferSent (
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed transferNonce,
        uint256 relayerFee
    );

    modifier onlyL1Bridge {
        _verifySender(l1BridgeAddress);
        _;
    }

    /// @notice When l2CanonicalTokenIsEth is true, l2CanonicalToken should be set to the WETH address
    constructor (
        address _l1Governance,
        HopBridgeToken _hToken, 
        IERC20 _l2CanonicalToken,
        bool _l2CanonicalTokenIsEth,
        address _l1BridgeAddress,
        uint256[] memory _supportedChainIds,
        address _exchangeAddress,
        address[] memory bonders
    )
        public
        Bridge(bonders)
    {
        require(NONCE_DOMAIN_SEPARATOR == keccak256("L2_Bridge v1.0"));

        l1Governance = _l1Governance;
        hToken = _hToken;
        l2CanonicalToken = _l2CanonicalToken;
        l2CanonicalTokenIsEth = _l2CanonicalTokenIsEth;
        l1BridgeAddress = _l1BridgeAddress;
        exchangeAddress = _exchangeAddress;

        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            supportedChainIds[_supportedChainIds[i]] = true;
        }
    }

    /* ========== Virtual functions ========== */

    function _sendCrossDomainMessage(bytes memory message) internal virtual;
    function _verifySender(address expectedSender) internal virtual; 

    /* ========== Public/External functions ========== */

    /// @notice _amount is the amount the user wants to send plus the relayer fee
    function send(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 relayerFee,
        uint256 amountOutMin,
        uint256 deadline
    )
        public
    {
        require(amount > 0, "L2_BRG: Must transfer a non-zero amount");
        require(amount >= relayerFee, "L2_BRG: Relayer fee cannot exceed amount");
        require(supportedChainIds[chainId], "L2_BRG: _chainId is not supported");

        bytes32[] storage pendingTransfers = pendingTransferIdsForChainId[chainId];

        if (pendingTransfers.length >= maxPendingTransfers) {
            _commitTransfers(chainId);
        }

        hToken.burn(msg.sender, amount);

        bytes32 transferNonce = getNextTransferNonce();
        transferNonceIncrementer++;

        bytes32 transferId = getTransferId(
            chainId,
            recipient,
            amount,
            transferNonce,
            relayerFee,
            amountOutMin,
            deadline
        );
        pendingTransfers.push(transferId);

        pendingAmountForChainId[chainId] = pendingAmountForChainId[chainId].add(amount);

        emit TransferSent(transferId, recipient, amount, transferNonce, relayerFee);
    }

    /// @notice amount is the amount the user wants to send plus the relayer fee
    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 relayerFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destinationAmountOutMin,
        uint256 destinationDeadline
    )
        external
        payable
    {
        require(amount >= relayerFee, "L2_BRG: relayer fee cannot exceed amount");

        if (l2CanonicalTokenIsEth) {
            require(msg.value == amount, "L2_BRG: Value does not match amount");
            IWETH(address(l2CanonicalToken)).deposit{value: amount}();
        } else {
            l2CanonicalToken.safeTransferFrom(msg.sender, address(this), amount);
        }

        address[] memory exchangePath = _getCHPath();
        uint256[] memory swapAmounts = IUniswapV2Router02(exchangeAddress).getAmountsOut(amount, exchangePath);
        uint256 swapAmount = swapAmounts[1];

        l2CanonicalToken.approve(exchangeAddress, amount);
        IUniswapV2Router02(exchangeAddress).swapExactTokensForTokens(
            amount,
            amountOutMin,
            exchangePath,
            msg.sender,
            deadline
        );

        send(chainId, recipient, swapAmount, relayerFee, destinationAmountOutMin, destinationDeadline);
    }

    function commitTransfers(uint256 destinationChainId) external {
        uint256 minForceCommitTime = lastCommitTimeForChainId[destinationChainId].add(minimumForceCommitDelay);
        require(minForceCommitTime < block.timestamp || getIsBonder(msg.sender), "L2_BRG: Only Bonder can commit before min delay");
        lastCommitTimeForChainId[destinationChainId] = block.timestamp;

        _commitTransfers(destinationChainId);
    }

    function mint(address recipient, uint256 amount) public onlyL1Bridge {
        hToken.mint(recipient, amount);
    }

    function mintAndAttemptSwap(address recipient, uint256 amount, uint256 amountOutMin, uint256 deadline) external onlyL1Bridge {
        _mintAndAttemptSwap(recipient, amount, amountOutMin, deadline);
    }

    function withdrawAndAttemptSwap(
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee,
        bytes32 rootHash,
        bytes32[] memory proof,
        uint256 amountOutMin,
        uint256 deadline
    )
        external
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            recipient,
            amount,
            transferNonce,
            relayerFee,
            amountOutMin,
            deadline
        );

        require(proof.verify(rootHash, transferId), "L2_BRG: Invalid transfer proof");
        _addToAmountWithdrawn(rootHash, amount);
        _withdrawAndAttemptSwap(transferId, recipient, amount, relayerFee, amountOutMin, deadline);
    }

    function bondWithdrawalAndAttemptSwap(
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee,
        uint256 amountOutMin,
        uint256 deadline
    )
        external
        onlyBonder
        requirePositiveBalance
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            recipient,
            amount,
            transferNonce,
            relayerFee,
            amountOutMin,
            deadline
        );

        _bondWithdrawal(transferId, amount);
        _withdrawAndAttemptSwap(transferId, recipient, amount, relayerFee, amountOutMin, deadline);
    }

    function setTransferRoot(bytes32 rootHash, uint256 totalAmount) external onlyL1Bridge {
        _setTransferRoot(rootHash, totalAmount);
    }

    /* ========== Helper Functions ========== */

    function _commitTransfers(uint256 destinationChainId) internal {
        bytes32[] storage pendingTransfers = pendingTransferIdsForChainId[destinationChainId];
        require(pendingTransfers.length > 0, "L2_BRG: Must commit at least 1 Transfer");

        bytes32 rootHash = MerkleUtils.getMerkleRoot(pendingTransfers);
        uint256 totalAmount = pendingAmountForChainId[destinationChainId];

        emit TransfersCommitted(rootHash, totalAmount);

        bytes memory confirmTransferRootMessage = abi.encodeWithSignature(
            "confirmTransferRoot(uint256,bytes32,uint256,uint256)",
            getChainId(),
            rootHash,
            destinationChainId,
            totalAmount
        );

        delete pendingTransferIdsForChainId[destinationChainId];

        _sendCrossDomainMessage(confirmTransferRootMessage);
    }

    function _mintAndAttemptSwap(address recipient, uint256 amount, uint256 amountOutMin, uint256 deadline) internal {
        hToken.mint(address(this), amount);
        hToken.approve(exchangeAddress, amount);

        bool success = true;
        if (l2CanonicalTokenIsEth) {
            try IUniswapV2Router02(exchangeAddress).swapExactTokensForETH(
                amount,
                amountOutMin,
                _getHCPath(),
                recipient,
                deadline
            ) returns (uint[] memory) {} catch {
                success = false;
            }
        } else {
            try IUniswapV2Router02(exchangeAddress).swapExactTokensForTokens(
                amount,
                amountOutMin,
                _getHCPath(),
                recipient,
                deadline
            ) returns (uint[] memory) {} catch {
                success = false;
            }
        }

        if (!success) {
            // Transfer hToken to recipient if swap fails
            IERC20(hToken).safeTransfer(recipient, amount);
        }
    }

    function _withdrawAndAttemptSwap(
        bytes32 transferId,
        address recipient,
        uint256 amount,
        uint256 relayerFee,
        uint256 amountOutMin,
        uint256 deadline
    ) internal {
        _markTransferSpent(transferId);
        // distribute fee
        _transferFromBridge(msg.sender, relayerFee);
        // Attempt swap to recipient
        uint256 amountAfterFee = amount.sub(relayerFee);
        _mintAndAttemptSwap(recipient, amountAfterFee, amountOutMin, deadline);
    }

    function _getHCPath() internal view returns (address[] memory) {
        address[] memory exchangePath = new address[](2);
        exchangePath[0] = address(hToken);
        exchangePath[1] = address(l2CanonicalToken);
        return exchangePath;
    }

    function _getCHPath() internal view returns (address[] memory) {
        address[] memory exchangePath = new address[](2);
        exchangePath[0] = address(l2CanonicalToken);
        exchangePath[1] = address(hToken);
        return exchangePath;
    }

    /* ========== Override Functions ========== */

    function _transferFromBridge(address recipient, uint256 amount) internal override {
        hToken.mint(recipient, amount);
    }

    function _transferToBridge(address from, uint256 amount) internal override {
        hToken.burn(from, amount);
    }

    function _requireIsGovernance() internal override {
        _verifySender(l1Governance);
    }

    /* ========== External Config Management Functions ========== */

    function setExchangeAddress(address _exchangeAddress) external onlyGovernance {
        exchangeAddress = _exchangeAddress;
    }

    function setL1BridgeAddress(address _l1BridgeAddress) external onlyGovernance {
        l1BridgeAddress = _l1BridgeAddress;
    }

    function setMessengerGasLimit(uint256 _messengerGasLimit) external onlyGovernance {
        messengerGasLimit = _messengerGasLimit;
    }

    function addSupportedChainIds(uint256[] calldata chainIds) external onlyGovernance {
        for (uint256 i = 0; i < chainIds.length; i++) {
            supportedChainIds[chainIds[i]] = true;
        }
    }

    function removeSupportedChainIds(uint256[] calldata chainIds) external onlyGovernance {
        for (uint256 i = 0; i < chainIds.length; i++) {
            supportedChainIds[chainIds[i]] = false;
        }
    }

    function setMinimumForceCommitDelay(uint256 _minimumForceCommitDelay) external onlyGovernance {
        minimumForceCommitDelay = _minimumForceCommitDelay;
    }

    function setMaxPendingTransfers(uint256 _maxPendingTransfers) external onlyGovernance {
        maxPendingTransfers = _maxPendingTransfers;
    }

    /* ========== Public Getters ========== */

    function getNextTransferNonce() public view returns (bytes32) {
        return keccak256(abi.encodePacked(NONCE_DOMAIN_SEPARATOR, getChainId(), transferNonceIncrementer));
    }
}
