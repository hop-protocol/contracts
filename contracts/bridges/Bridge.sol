// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

import "./Accounting.sol";
import "../libraries/MerkleUtils.sol";

/**
 * @dev Bridge extends the accounting system and encapsulates the logic that is shared by both the
 * L1 and L2 Bridges. It allows to TransferRoots to be set by parent contracts and for those
 * TransferRoots to be withdrawn against. It also allows the bonder to bond and withdraw Transfers
 * directly through `bondWithdrawal` and then settle those bonds against their TransferRoot once it
 * has been set.
 */

abstract contract Bridge is Accounting {
    using MerkleProof for bytes32[];

    struct TransferRoot {
        uint256 total;
        uint256 amountWithdrawn;
    }

    /* ========== Events ========== */

    event Withdrew(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee
    );

    event WithdrawalBonded(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee
    );

    event WithdrawalBondSettled(
        address bonder,
        bytes32 transferId,
        bytes32 rootHash
    );

    event MultipleWithdrawalsSettled(
        address bonder,
        bytes32 rootHash,
        uint256 totalBondsSettled
    );

    /* ========== State ========== */

    mapping(bytes32 => TransferRoot) private _transferRoots;
    mapping(bytes32 => bool) private _spentTransferIds;
    mapping(address => mapping(bytes32 => uint256)) private _bondedWithdrawalAmounts;

    constructor(address[] memory bonders) public Accounting(bonders) {}

    /* ========== Public getters ========== */

    /**
     * @dev Get the hash that represents an individual Transfer.
     * @param chainId The id of the destination chain
     * @param sender The address sending the Transfer
     * @param recipient The address receiving the Transfer
     * @param amount The amount being transferred including the `_relayerFee`
     * @param transferNonce Used to avoid transferId collisions
     * @param relayerFee The amount paid to the address that withdraws the Transfer
     * @param amountOutMin The minimum amount received after attempting to swap in the destination
     * Uniswap market. 0 if no swap is intended.
     * @param deadline The deadline for swapping in the destination Uniswap market. 0 if no
     * swap is intended.
     */
    function getTransferId(
        uint256 chainId,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee,
        uint256 amountOutMin,
        uint256 deadline
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            chainId,
            sender,
            recipient,
            amount,
            transferNonce,
            relayerFee,
            amountOutMin,
            deadline
        ));
    }

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        this; // Silence state mutability warning without generating any additional byte code
        assembly {
            chainId := chainid()
        }
    }

    /**
     * @dev Get the TransferRoot id for a given rootHash and totalAmount
     * @param rootHash The merkle root of the TransferRoot
     * @param totalAmount The merkle root of the TransferRoot
     */
    function getTransferRootId(bytes32 rootHash, uint256 totalAmount) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(rootHash, totalAmount));
    }

    /**
     * @dev Get the TransferRoot for a given rootHash and totalAmount
     * @param rootHash The merkle root of the TransferRoot
     * @param totalAmount The total of all Transfers in the TransferRoot
     */
    function getTransferRoot(bytes32 rootHash, uint256 totalAmount) public view returns (TransferRoot memory) {
        return _transferRoots[getTransferRootId(rootHash, totalAmount)];
    }

    /**
     * @dev Get the TransferRoot for a given rootHash
     * @param bonder The Bonder of the withdrawal
     * @param transferId The Transfer's unique identifier
     */
    function getBondedWithdrawalAmount(address bonder, bytes32 transferId) external view returns (uint256) {
        return _bondedWithdrawalAmounts[bonder][transferId];
    }

    /* ========== User/relayer public functions ========== */

    /**
     * @notice Can be called by anyone (recipient or relayer)
     * @dev Withdraw a Transfer from its destination bridge
     * @param sender The address sending the Transfer
     * @param recipient The address receiving the Transfer
     * @param amount The amount being transferred including the `_relayerFee`
     * @param transferNonce Used to avoid transferId collisions
     * @param relayerFee The amount paid to the address that withdraws the Transfer
     * @param transferRootId The Merkle root of the TransferRoot
     * @param proof The Merkle proof that proves the Transfer's inclusion in the TransferRoot
     */
    function withdraw(
        address sender,
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee,
        bytes32 transferRootId,
        bytes32[] memory proof
    )
        public
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            sender,
            recipient,
            amount,
            transferNonce,
            relayerFee,
            0,
            0
        );

        require(proof.verify(transferRootId, transferId), "BRG: Invalid transfer proof");
        _addToAmountWithdrawn(transferRootId, amount);
        _fulfillWithdraw(transferId, recipient, amount, relayerFee);

        emit Withdrew(transferId, sender, recipient, amount, transferNonce, relayerFee);
    }

    /**
     * @dev Allows the bonder to bond individual withdrawals before their TransferRoot has been committed.
     * @param sender The address sending the Transfer
     * @param recipient The address receiving the Transfer
     * @param amount The amount being transferred including the `_relayerFee`
     * @param transferNonce Used to avoid transferId collisions
     * @param relayerFee The amount paid to the address that withdraws the Transfer
     */
    function bondWithdrawal(
        address sender,
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 relayerFee
    )
        public
        onlyBonder
        requirePositiveBalance
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            sender,
            recipient,
            amount,
            transferNonce,
            relayerFee,
            0,
            0
        );

        _bondWithdrawal(transferId, amount);
        _fulfillWithdraw(transferId, recipient, amount, relayerFee);

        emit WithdrawalBonded(transferId, sender, recipient, amount, transferNonce, relayerFee);
    }

    /**
     * @dev Refunds the bonders stake from a bonded withdrawal and counts that withdrawal against
     * its TransferRoot.
     * @param bonder The Bonder of the withdrawal
     * @param transferId The Transfer's unique identifier
     * @param rootHash The merkle root of the TransferRoot
     * @param proof The Merkle proof that proves the Transfer's inclusion in the TransferRoot
     */
    function settleBondedWithdrawal(
        address bonder,
        bytes32 transferId,
        bytes32 rootHash,
        uint256 transferRootTotalAmount,
        bytes32[] memory proof
    )
        public
    {
        require(proof.verify(rootHash, transferId), "L2_BRG: Invalid transfer proof");

        bytes32 transferRootId = getTransferRootId(rootHash, transferRootTotalAmount);
        uint256 amount = _bondedWithdrawalAmounts[bonder][transferId];
        _addToAmountWithdrawn(transferRootId, amount);

        _bondedWithdrawalAmounts[bonder][transferId] = 0;
        _addCredit(bonder, amount);

        emit WithdrawalBondSettled(bonder, transferId, rootHash);
    }

    function settleBondedWithdrawals(
        address bonder,
        bytes32[] memory transferIds,
        uint256 totalAmount
    )
        public
    {
        bytes32 rootHash = MerkleUtils.getMerkleRoot(transferIds);

        bytes32 transferRootId = getTransferRootId(rootHash, totalAmount);
        TransferRoot storage transferRoot = _transferRoots[transferRootId];
        require(transferRoot.total > 0, "BRG: Transfer root not found");

        uint256 totalBondsSettled = 0;
        for(uint256 i = 0; i < transferIds.length; i++) {
            uint256 transferBondAmount = _bondedWithdrawalAmounts[bonder][transferIds[i]];
            totalBondsSettled = totalBondsSettled.add(transferBondAmount);
            _bondedWithdrawalAmounts[bonder][transferIds[i]] = 0;
        }

        uint256 newAmountWithdrawn = transferRoot.amountWithdrawn.add(totalBondsSettled);
        require(newAmountWithdrawn <= transferRoot.total, "BRG: Withdrawal exceeds TransferRoot total");
        transferRoot.amountWithdrawn = newAmountWithdrawn;

        _addCredit(bonder, totalBondsSettled);

        emit MultipleWithdrawalsSettled(bonder, rootHash, totalBondsSettled);
    }

    /* ========== Internal functions ========== */

    function _markTransferSpent(bytes32 transferId) internal {
        require(!_spentTransferIds[transferId], "BRG: The transfer has already been withdrawn");
        _spentTransferIds[transferId] = true;
    }

    function _addToAmountWithdrawn(
        bytes32 transferRootId,
        uint256 amount
    )
        internal
    {
        TransferRoot storage transferRoot = _transferRoots[transferRootId];
        require(transferRoot.total > 0, "BRG: Transfer root not found");

        uint256 newAmountWithdrawn = transferRoot.amountWithdrawn.add(amount);
        require(newAmountWithdrawn <= transferRoot.total, "BRG: Withdrawal exceeds TransferRoot total");

        transferRoot.amountWithdrawn = newAmountWithdrawn;
    }

    function _setTransferRoot(bytes32 rootHash, uint256 amount) internal {
        bytes32 transferRootId = getTransferRootId(rootHash, amount);
        require(_transferRoots[transferRootId].total == 0, "BRG: Transfer root already set");
        require(amount > 0, "BRG: Cannot set TransferRoot amount of 0");

        _transferRoots[transferRootId] = TransferRoot(amount, 0);
    }

    function _bondWithdrawal(bytes32 transferId, uint256 amount) internal {
        require(_bondedWithdrawalAmounts[msg.sender][transferId] == 0, "BRG: Withdrawal has already been bonded");
        _addDebit(msg.sender, amount);
        _bondedWithdrawalAmounts[msg.sender][transferId] = amount;
    }

    /* ========== Private functions ========== */

    /// @dev Completes the Transfer, distributes the relayer fee and marks the Transfer as spent.
    function _fulfillWithdraw(
        bytes32 transferId,
        address recipient,
        uint256 amount,
        uint256 relayerFee
    ) private {
        _markTransferSpent(transferId);
        _transferFromBridge(recipient, amount.sub(relayerFee));
        _transferFromBridge(msg.sender, relayerFee);
    }
}
