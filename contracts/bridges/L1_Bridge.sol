// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";

import "../interfaces/IMessengerWrapper.sol";
import "./L1_BridgeConfig.sol";

/**
 * @dev L1_Bridge is responsible for the bonding and challenging of TransferRoots. All TransferRoots
 * originate in the L1_Bridge through `bondTransferRoot` and are propagated up to destination L2s.
 */

contract L1_Bridge is Bridge, L1_BridgeConfig {

    struct TransferBond {
        address bonder;
        uint256 createdAt;
        uint256 totalAmount;
        bool confirmed;
        uint256 challengeStartTime;
        address challenger;
    }

    /* ========== State ========== */

    IERC20 public l1CanonicalToken;
    mapping(bytes32 => bool) public transferRootConfirmed;
    mapping(bytes32 => TransferBond) public transferBonds;
    mapping(uint256 => uint256) public timeSlotToAmountBonded;
    uint256 public amountChallenged;
    mapping(uint256 => uint256) public chainBalance;

    /* ========== Events ========== */

    event TransferRootBonded (
        bytes32 indexed root,
        uint256 amount
    );

    /* ========== Modifiers ========== */

    modifier onlyL2Bridge {
        // ToDo: Figure out how to check sender against an allowlist
        // IMessengerWrapper messengerWrapper = crossDomainMessengerWrapper[_chainId];
        // messengerWrapper.verifySender(msg.data);
        _;
    }

    constructor (IERC20 _l1CanonicalToken, address[] memory bonders) public Bridge(bonders) {
        l1CanonicalToken = _l1CanonicalToken;
    }

    /* ========== Public Transfers Functions ========== */

    function sendToL2(
        uint256 chainId,
        address recipient,
        uint256 amount
    )
        public
    {
        IMessengerWrapper messengerWrapper = getCrossDomainMessengerWrapper(chainId);
        require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");

        l1CanonicalToken.safeTransferFrom(msg.sender, address(this), amount);

        bytes memory mintCalldata = abi.encodeWithSignature("mint(address,uint256)", recipient, amount);

        chainBalance[chainId] = chainBalance[chainId].add(amount);
        messengerWrapper.sendCrossDomainMessage(mintCalldata);
    }

    function sendToL2AndAttemptSwap(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 amountOutMin,
        uint256 deadline
    )
        public
    {
        IMessengerWrapper messengerWrapper = getCrossDomainMessengerWrapper(chainId);
        require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");

        l1CanonicalToken.safeTransferFrom(msg.sender, address(this), amount);

        bytes memory mintAndAttemptSwapCalldata = abi.encodeWithSignature(
            "mintAndAttemptSwap(address,uint256,uint256,uint256)",
            recipient,
            amount,
            amountOutMin,
            deadline
        );

        chainBalance[chainId] = chainBalance[chainId].add(amount);
        messengerWrapper.sendCrossDomainMessage(mintAndAttemptSwapCalldata);
    }

    /* ========== Public Transfer Root Functions ========== */

    /**
     * @dev Setting a TransferRoot is a two step process.
     * @dev   1. The TransferRoot is bonded with `bondTransferRoot`. Withdrawals can now begin on L1
     * @dev      and recipient L2's
     * @dev   2. The TransferRoot is confirmed after `confirmTransferRoot` is called by the l2 bridge
     * @dev      where the TransferRoot originated.
     */

    /**
     * @dev Used by the bonder to bond a TransferRoot and propagate it up to destination L2s
     * @param rootHash The Merkle root of the TransferRoot Merkle tree
     * @param destinationChainId The id of the destination chain
     * @param totalAmount The amount destined for the destination chain
     */
    function bondTransferRoot(
        bytes32 rootHash,
        uint256 destinationChainId,
        uint256 totalAmount
    )
        external
        onlyBonder
        requirePositiveBalance
    {
        bytes32 transferRootId = getTransferRootId(rootHash, totalAmount);
        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: Transfer Root has already been confirmed");
        require(transferBonds[transferRootId].createdAt == 0, "L1_BRG: Transfer Root has already been bonded");

        uint256 currentTimeSlot = getTimeSlot(block.timestamp);
        uint256 bondAmount = getBondForTransferAmount(totalAmount);
        timeSlotToAmountBonded[currentTimeSlot] = timeSlotToAmountBonded[currentTimeSlot].add(bondAmount);

        transferBonds[transferRootId] = TransferBond(msg.sender, block.timestamp, totalAmount, false, 0, address(0));

        _distributeTransferRoot(rootHash, destinationChainId, totalAmount);

        emit TransferRootBonded(rootHash, totalAmount);
    }

    /**
     * @dev Used by an L2 bridge to confirm a TransferRoot via cross-domain message. Once a TransferRoot
     * has been confirmed, any challenge against that TransferRoot can be resolved as unsuccessful.
     * @param chainId The id of the destination chain
     * @param rootHash The Merkle root of the TransferRoot Merkle tree
     * @param destinationChainId The id of the destination chain
     * @param totalAmount The amount destined for each destination chain
     */
    function confirmTransferRoot(
        uint256 chainId,
        bytes32 rootHash,
        uint256 destinationChainId,
        uint256 totalAmount
    )
        public
        onlyL2Bridge
    {
        bytes32 transferRootId = getTransferRootId(rootHash, totalAmount);
        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: TransferRoot already confirmed");
        transferRootConfirmed[transferRootId] = true;
        chainBalance[chainId] = chainBalance[chainId].sub(totalAmount, "L1_BRG: Amount exceeds chainBalance. This indicates a layer-2 failure.");

        // If the TransferRoot was never bonded, distribute the TransferRoot. If it has been bonded, 
        // require that the chainIds and chainAmounts match the values coming from the L2_Bridge.
        TransferBond storage transferBond = transferBonds[transferRootId];
        if (transferBond.createdAt == 0) {
            _distributeTransferRoot(rootHash, destinationChainId, totalAmount);
        }
    }

    function _distributeTransferRoot(
        bytes32 rootHash,
        uint256 chainId,
        uint256 totalAmount
    )
        internal
    {
        // Set TransferRoot on recipient Bridge
        if (chainId == getChainId()) {
            // Set L1 transfer root
            _setTransferRoot(rootHash, totalAmount);
        } else {
            IMessengerWrapper messengerWrapper = getCrossDomainMessengerWrapper(chainId);
            require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");

            // Set L2 transfer root
            bytes memory setTransferRootMessage = abi.encodeWithSignature(
                "setTransferRoot(bytes32,uint256)",
                rootHash,
                totalAmount
            );
            messengerWrapper.sendCrossDomainMessage(setTransferRootMessage);
        }
    }

    /* ========== Public TransferRoot Challenges ========== */

    function challengeTransferBond(bytes32 rootHash, uint256 originalAmount) public {
        bytes32 transferRootId = getTransferRootId(rootHash, originalAmount);
        TransferRoot memory transferRoot = getTransferRoot(rootHash, originalAmount);
        TransferBond storage transferBond = transferBonds[transferRootId];

        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: Transfer root has already been confirmed");
        uint256 challengePeriodEnd = transferBond.createdAt.add(getChallengePeriod());
        require(challengePeriodEnd >= block.timestamp, "L1_BRG: Transfer root cannot be challenged after challenge period");

        // Get stake for challenge
        uint256 challengeStakeAmount = getChallengeAmountForTransferAmount(transferRoot.total);
        l1CanonicalToken.transferFrom(msg.sender, address(this), challengeStakeAmount);

        transferBond.challengeStartTime = now;
        transferBond.challenger = msg.sender;

        // Move amount from timeSlotToAmountBonded to debit
        uint256 timeSlot = getTimeSlot(transferBond.createdAt);
        uint256 bondAmount = getBondForTransferAmount(transferRoot.total);
        timeSlotToAmountBonded[timeSlot] = timeSlotToAmountBonded[timeSlot].sub(bondAmount);

        _addDebit(transferBond.bonder, bondAmount);
    }

    function resolveChallenge(bytes32 rootHash, uint256 originalAmount) public {
        bytes32 transferRootId = getTransferRootId(rootHash, originalAmount);
        TransferRoot memory transferRoot = getTransferRoot(rootHash, originalAmount);
        TransferBond storage transferBond = transferBonds[transferRootId];

        require(transferBond.challengeStartTime != 0, "L1_BRG: Transfer root has not been challenged");
        require(now > transferBond.challengeStartTime.add(getChallengeResolutionPeriod()), "L1_BRG: Challenge period has not ended");

        uint256 challengeStakeAmount = getChallengeAmountForTransferAmount(transferRoot.total);

        if (transferRootConfirmed[transferRootId]) {
            // Invalid challenge
            // Credit the bonder back with the bond amount plus the challenger's stake
            _addCredit(transferBond.bonder, getBondForTransferAmount(transferRoot.total).add(challengeStakeAmount));
        } else {
            // Valid challenge
            // Burn 25% of the challengers stake
            l1CanonicalToken.transfer(address(0xd3ad), challengeStakeAmount.mul(1).div(4));
            // Reward challenger with the remaining 75% of their stake plus 100% of the Bonder's stake
            l1CanonicalToken.transfer(transferBond.challenger, challengeStakeAmount.mul(7).div(4));
        }
    }

    /* ========== Internal functions ========== */

    function _transferFromBridge(address recipient, uint256 amount) internal override {
        l1CanonicalToken.safeTransfer(recipient, amount);
    }

    function _transferToBridge(address from, uint256 amount) internal override {
        l1CanonicalToken.safeTransferFrom(from, address(this), amount);
    }

    function _additionalDebit() internal view override returns (uint256) {
        uint256 currentTimeSlot = getTimeSlot(now);
        uint256 bonded = 0;

        for (uint256 i = 0; i < 4; i++) {
            bonded = bonded.add(timeSlotToAmountBonded[currentTimeSlot - i]);
        }

        return bonded;
    }
}
