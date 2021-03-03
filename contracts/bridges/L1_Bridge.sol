// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";
import "../interfaces/IMessengerWrapper.sol";

/**
 * @dev L1_Bridge is responsible for the bonding and challenging of TransferRoots. All TransferRoots
 * originate in the L1_Bridge through `bondTransferRoot` and are propagated up to destination L2s.
 */

abstract contract L1_Bridge is Bridge {

    struct TransferBond {
        address bonder;
        uint256 createdAt;
        uint256 totalAmount;
        uint256 rootCommittedAt;
        uint256 challengeStartTime;
        address challenger;
        bool challengeResolved;
    }

    /* ========== State ========== */

    mapping(bytes32 => bool) public transferRootConfirmed;
    mapping(bytes32 => TransferBond) public transferBonds;
    mapping(uint256 => uint256) public timeSlotToAmountBonded;
    mapping(uint256 => uint256) public chainBalance;

    /* ========== Config State ========== */

    address public governance;
    mapping(uint256 => IMessengerWrapper) public crossDomainMessengerWrappers;
    mapping(uint256 => bool) public isSendToChainIdPaused;
    uint256 public challengeAmountMultiplier = 1;
    uint256 public challengeAmountDivisor = 10;
    uint256 public timeSlotSize = 3 hours;
    uint256 public challengePeriod = 1 days;
    uint256 public challengeResolutionPeriod = 10 days;

    uint256 constant MIN_TRANSFER_ROOT_BOND_DELAY = 15 minutes;

    /* ========== Events ========== */

    event TransferRootBonded (
        bytes32 indexed root,
        uint256 amount
    );

    event TransferRootConfirmed(
        uint256 originChainId,
        uint256 destinationChainId,
        bytes32 rootHash,
        uint256 totalAmount
    );

    event TransferBondChallenged(
        bytes32 transferRootId,
        bytes32 rootHash,
        uint256 originalAmount
    );

    event ChallengeResolved(
        bytes32 transferRootId,
        bytes32 rootHash,
        uint256 originalAmount
    );

    /* ========== Modifiers ========== */

    modifier onlyL2Bridge(uint256 chainId) {
        IMessengerWrapper messengerWrapper = crossDomainMessengerWrappers[chainId];
        messengerWrapper.verifySender(msg.data);
        _;
    }

    constructor (address[] memory bonders) public Bridge(bonders) {
        governance = msg.sender;
    }

    /* ========== Public Transfers Functions ========== */

    function sendToL2(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 relayerFee
    )
        external
        payable
    {
        IMessengerWrapper messengerWrapper = crossDomainMessengerWrappers[chainId];
        require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");
        require(isSendToChainIdPaused[chainId] == false, "L1_BRG: Sends to this chainId are paused");

        _transferToBridge(msg.sender, amount);

        bytes memory mintCalldata = abi.encodeWithSignature("mint(address,uint256,uint256)", recipient, amount, relayerFee);

        chainBalance[chainId] = chainBalance[chainId].add(amount);
        messengerWrapper.sendCrossDomainMessage(mintCalldata);
    }

    function sendToL2AndAttemptSwap(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 relayerFee
    )
        external
        payable
    {
        IMessengerWrapper messengerWrapper = crossDomainMessengerWrappers[chainId];
        require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");
        require(isSendToChainIdPaused[chainId] == false, "L1_BRG: Sends to this chainId are paused");

        _transferToBridge(msg.sender, amount);

        bytes memory mintAndAttemptSwapCalldata = abi.encodeWithSignature(
            "mintAndAttemptSwap(address,uint256,uint256,uint256,uint256)",
            recipient,
            amount,
            amountOutMin,
            deadline,
            relayerFee
        );

        chainBalance[chainId] = chainBalance[chainId].add(amount);
        messengerWrapper.sendCrossDomainMessage(mintAndAttemptSwapCalldata);
    }

    /* ========== Public TransferRoot Functions ========== */

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
        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: TransferRoot has already been confirmed");
        require(transferBonds[transferRootId].createdAt == 0, "L1_BRG: TransferRoot has already been bonded");

        uint256 currentTimeSlot = getTimeSlot(block.timestamp);
        uint256 bondAmount = getBondForTransferAmount(totalAmount);
        timeSlotToAmountBonded[currentTimeSlot] = timeSlotToAmountBonded[currentTimeSlot].add(bondAmount);

        transferBonds[transferRootId] = TransferBond(
            msg.sender,
            block.timestamp,
            totalAmount,
            uint256(0),
            uint256(0),
            address(0),
            false
        );

        _distributeTransferRoot(rootHash, destinationChainId, totalAmount);

        emit TransferRootBonded(rootHash, totalAmount);
    }

    /**
     * @dev Used by an L2 bridge to confirm a TransferRoot via cross-domain message. Once a TransferRoot
     * has been confirmed, any challenge against that TransferRoot can be resolved as unsuccessful.
     * @param originChainId The id of the origin chain
     * @param rootHash The Merkle root of the TransferRoot Merkle tree
     * @param destinationChainId The id of the destination chain
     * @param totalAmount The amount destined for each destination chain
     */
    function confirmTransferRoot(
        uint256 originChainId,
        bytes32 rootHash,
        uint256 destinationChainId,
        uint256 totalAmount,
        uint256 rootCommittedAt
    )
        external
        onlyL2Bridge(originChainId)
    {
        bytes32 transferRootId = getTransferRootId(rootHash, totalAmount);
        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: TransferRoot already confirmed");
        transferRootConfirmed[transferRootId] = true;
        chainBalance[originChainId] = chainBalance[originChainId].sub(totalAmount, "L1_BRG: Amount exceeds chainBalance. This indicates a layer-2 failure.");

        // If the TransferRoot was never bonded, distribute the TransferRoot. If it has been bonded, 
        // set the rootCommittedAt which is needed in case of a challenge.
        TransferBond storage transferBond = transferBonds[transferRootId];
        if (transferBond.createdAt == 0) {
            _distributeTransferRoot(rootHash, destinationChainId, totalAmount);
        } else {
            transferBond.rootCommittedAt = rootCommittedAt;
        }

        emit TransferRootConfirmed(originChainId, destinationChainId, rootHash, totalAmount);
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
            // Set L1 TransferRoot
            _setTransferRoot(rootHash, totalAmount);
        } else {
            IMessengerWrapper messengerWrapper = crossDomainMessengerWrappers[chainId];
            require(messengerWrapper != IMessengerWrapper(0), "L1_BRG: chainId not supported");

            // Set L2 TransferRoot
            bytes memory setTransferRootMessage = abi.encodeWithSignature(
                "setTransferRoot(bytes32,uint256)",
                rootHash,
                totalAmount
            );
            messengerWrapper.sendCrossDomainMessage(setTransferRootMessage);
        }
    }

    /* ========== External TransferRoot Challenges ========== */

    function challengeTransferBond(bytes32 rootHash, uint256 totalAmountBonded) external payable {
        bytes32 transferRootId = getTransferRootId(rootHash, totalAmountBonded);
        TransferRoot memory transferRoot = getTransferRoot(rootHash, totalAmountBonded);
        TransferBond storage transferBond = transferBonds[transferRootId];

        require(transferRoot.total > 0, "L1_BRG: TransferRoot not found");
        require(transferRootConfirmed[transferRootId] == false, "L1_BRG: TransferRoot has already been confirmed");
        uint256 challengePeriodEnd = transferBond.createdAt.add(challengePeriod);
        require(challengePeriodEnd >= block.timestamp, "L1_BRG: TransferRoot cannot be challenged after challenge period");
        require(transferBond.challengeStartTime == 0, "L1_BRG: TransferRoot already challenged");

        transferBond.challengeStartTime = block.timestamp;
        transferBond.challenger = msg.sender;

        // Move amount from timeSlotToAmountBonded to debit
        uint256 timeSlot = getTimeSlot(transferBond.createdAt);
        uint256 bondAmount = getBondForTransferAmount(transferRoot.total);
        timeSlotToAmountBonded[timeSlot] = timeSlotToAmountBonded[timeSlot].sub(bondAmount);

        _addDebit(transferBond.bonder, bondAmount);

        // Get stake for challenge
        uint256 challengeStakeAmount = getChallengeAmountForTransferAmount(transferRoot.total);
        _transferToBridge(msg.sender, challengeStakeAmount);

        emit TransferBondChallenged(transferRootId, rootHash, totalAmountBonded);
    }

    function resolveChallenge(bytes32 rootHash, uint256 originalAmount) external {
        bytes32 transferRootId = getTransferRootId(rootHash, originalAmount);
        TransferRoot memory transferRoot = getTransferRoot(rootHash, originalAmount);
        TransferBond storage transferBond = transferBonds[transferRootId];

        require(transferRoot.total > 0, "L1_BRG: TransferRoot not found");
        require(transferBond.challengeStartTime != 0, "L1_BRG: TransferRoot has not been challenged");
        require(block.timestamp > transferBond.challengeStartTime.add(challengeResolutionPeriod), "L1_BRG: Challenge period has not ended");
        require(transferBond.challengeResolved == false, "L1_BRG: TransferRoot already resolved");
        transferBond.challengeResolved = true;

        uint256 challengeStakeAmount = getChallengeAmountForTransferAmount(transferRoot.total);

        if (transferRootConfirmed[transferRootId]) {
            // Invalid challenge

            if (transferBond.createdAt > transferBond.rootCommittedAt.add(MIN_TRANSFER_ROOT_BOND_DELAY)) {
                // Credit the bonder back with the bond amount plus the challenger's stake
                _addCredit(transferBond.bonder, getBondForTransferAmount(transferRoot.total).add(challengeStakeAmount));
            } else {
                // If the TransferRoot was bonded before it was committed, the challenger and Bonder
                // get their stake back. This discourages Bonders from tricking challengers into
                // challenging a valid TransferRoots that haven't yet been committed. It also ensures
                // that Bonders are not punished if a TransferRoot is bonded too soon in error.

                // Return the challenger's stake
                _transferFromBridge(transferBond.challenger, challengeStakeAmount);
                // Credit the bonder back with the bond amount plus the challenger's stake
                _addCredit(transferBond.bonder, getBondForTransferAmount(transferRoot.total));
            }
        } else {
            // Valid challenge
            // Burn 25% of the challengers stake
            _transferFromBridge(address(0xdead), challengeStakeAmount.mul(1).div(4));
            // Reward challenger with the remaining 75% of their stake plus 100% of the Bonder's stake
            _transferFromBridge(transferBond.challenger, challengeStakeAmount.mul(7).div(4));
        }

        emit ChallengeResolved(transferRootId, rootHash, originalAmount);
    }

    /* ========== Override Functions ========== */

    function _additionalDebit() internal view override returns (uint256) {
        uint256 currentTimeSlot = getTimeSlot(block.timestamp);
        uint256 bonded = 0;

        uint256 numTimeSlots = challengePeriod / timeSlotSize;
        for (uint256 i = 0; i < numTimeSlots; i++) {
            bonded = bonded.add(timeSlotToAmountBonded[currentTimeSlot - i]);
        }

        return bonded;
    }

    function _requireIsGovernance() internal override {
        require(governance == msg.sender, "L1_BRG: Caller is not the owner");
    }

    /* ========== External Config Management Setters ========== */

    function setGovernance(address _newGovernance) external onlyGovernance {
        require(_newGovernance != address(0), "L1_BRG: _newGovernance cannot be address(0)");
        governance = _newGovernance;
    }

    function setCrossDomainMessengerWrapper(uint256 chainId, IMessengerWrapper _crossDomainMessengerWrapper) external onlyGovernance {
        crossDomainMessengerWrappers[chainId] = _crossDomainMessengerWrapper;
    }

    function setChainIdDepositsPaused(uint256 chainId, bool paused) external onlyGovernance {
        isSendToChainIdPaused[chainId] = paused;
    }

    function setChallengeAmountDivisor(uint256 _challengeAmountDivisor) external onlyGovernance {
        challengeAmountDivisor = _challengeAmountDivisor;
    }

    function setChallengePeriodAndTimeSlotSize(uint256 _challengePeriod, uint256 _timeSlotSize) external onlyGovernance {
        require(challengePeriod % timeSlotSize == 0, "L1_BRG: challengePeriod must be divisible by timeSlotSize");
        challengePeriod = _challengePeriod;
        timeSlotSize = _timeSlotSize;
    }

    function setChallengeAmountMultiplier(uint256 _challengeAmountMultiplier) external onlyGovernance {
        challengeAmountMultiplier = _challengeAmountMultiplier;
    }

    function setChallengeResolutionPeriod(uint256 _challengeResolutionPeriod) external onlyGovernance {
        challengeResolutionPeriod = _challengeResolutionPeriod;
    }

    /* ========== Public Getters ========== */

    function getBondForTransferAmount(uint256 amount) public view returns (uint256) {
        // Bond covers amount plus a bounty to pay a potential challenger
        return amount.add(getChallengeAmountForTransferAmount(amount));
    }

    function getChallengeAmountForTransferAmount(uint256 amount) public view returns (uint256) {
        // Bond covers amount plus a bounty to pay a potential challenger
        return amount.mul(challengeAmountMultiplier).div(challengeAmountDivisor);
    }

    function getTimeSlot(uint256 time) public view returns (uint256) {
        return time / timeSlotSize;
    }
}
