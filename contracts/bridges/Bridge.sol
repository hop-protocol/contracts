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

    mapping(bytes32 => TransferRoot) private _transferRoots;
    mapping(bytes32 => bool) private _spentTransferIds;
    mapping(bytes32 => uint256) private _bondedWithdrawalAmounts;

    constructor(address _bonder) public Accounting(_bonder) {}

    /* ========== Public getters ========== */

    /**
     * @dev Get the hash that represents an individual Transfer.
     * @param _chainId The id of the destination chain
     * @param _sender The address sending the Transfer
     * @param _recipient The address receiving the Transfer
     * @param _amount The amount being transferred including the `_relayerFee`
     * @param _transferNonce Used to avoid transferId collisions
     * @param _relayerFee The amount paid to the address that withdraws the Transfer
     * @param _amountOutMin The minimum amount received after attempting to swap in the destination
     * Uniswap market. 0 if no swap is intended.
     * @param _deadline The deadline for swapping in the destination Uniswap market. 0 if no
     * swap is intended.
     */
    function getTransferId(
        uint256 _chainId,
        address _sender,
        address _recipient,
        uint256 _amount,
        uint256 _transferNonce,
        uint256 _relayerFee,
        uint256 _amountOutMin,
        uint256 _deadline
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            _chainId,
            _sender,
            _recipient,
            _amount,
            _transferNonce,
            _relayerFee,
            _amountOutMin,
            _deadline
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
     * @param _rootHash The merkle root of the TransferRoot
     */
    function getTransferRootId(bytes32 _rootHash, uint256 _totalAmount) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_rootHash, _totalAmount));
    }

    /**
     * @dev Get the TransferRoot for a given rootHash and totalAmount
     * @param _rootHash The merkle root of the TransferRoot
     */
    function getTransferRoot(bytes32 _rootHash, uint256 _totalAmount) public view returns (TransferRoot memory) {
        return _transferRoots[getTransferRootId(_rootHash, _totalAmount)];
    }

    /**
     * @dev Get the TransferRoot for a given rootHash
     * @param _transferId The Transfer's unique identifier
     */
    function getBondedWithdrawalAmount(bytes32 _transferId) external view returns (uint256) {
        return _bondedWithdrawalAmounts[_transferId];
    }

    /* ========== User/relayer public functions ========== */

    /**
     * @notice Can be called by anyone (recipient or relayer)
     * @dev Withdraw a Transfer from its destination bridge
     * @param _sender The address sending the Transfer
     * @param _recipient The address receiving the Transfer
     * @param _amount The amount being transferred including the `_relayerFee`
     * @param _transferNonce Used to avoid transferId collisions
     * @param _relayerFee The amount paid to the address that withdraws the Transfer
     * @param _transferRootId The Merkle root of the TransferRoot
     * @param _proof The Merkle proof that proves the Transfer's inclusion in the TransferRoot
     */
    function withdraw(
        address _sender,
        address _recipient,
        uint256 _amount,
        uint256 _transferNonce,
        uint256 _relayerFee,
        bytes32 _transferRootId,
        bytes32[] memory _proof
    )
        public
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            _sender,
            _recipient,
            _amount,
            _transferNonce,
            _relayerFee,
            0,
            0
        );

        require(_proof.verify(_transferRootId, transferId), "BRG: Invalid transfer proof");
        _addToAmountWithdrawn(_transferRootId, _amount);
        _fulfillWithdraw(transferId, _recipient, _amount, _relayerFee);
    }

    // ToDo: enforce _transferNonce can't collide on send or autogenerate nonce

    /**
     * @dev Allows the bonder to bond individual withdrawals before their TransferRoot has been committed.
     * @param _sender The address sending the Transfer
     * @param _recipient The address receiving the Transfer
     * @param _amount The amount being transferred including the `_relayerFee`
     * @param _transferNonce Used to avoid transferId collisions
     * @param _relayerFee The amount paid to the address that withdraws the Transfer
     */
    function bondWithdrawal(
        address _sender,
        address _recipient,
        uint256 _amount,
        uint256 _transferNonce,
        uint256 _relayerFee
    )
        public
        onlyBonder
        requirePositiveBalance
    {
        bytes32 transferId = getTransferId(
            getChainId(),
            _sender,
            _recipient,
            _amount,
            _transferNonce,
            _relayerFee,
            0,
            0
        );

        _addDebit(_amount);
        _setBondedWithdrawalAmount(transferId, _amount);
        _fulfillWithdraw(transferId, _recipient, _amount, _relayerFee);
    }

    /**
     * @dev Refunds the bonders stake from a bonded withdrawal and counts that withdrawal against
     * its TransferRoot.
     * @param _transferId The Transfer's unique identifier
     * @param _rootHash The merkle root of the TransferRoot
     * @param _proof The Merkle proof that proves the Transfer's inclusion in the TransferRoot
     */
    function settleBondedWithdrawal(
        bytes32 _transferId,
        bytes32 _rootHash,
        bytes32[] memory _proof
    )
        public
    {
        require(_proof.verify(_rootHash, _transferId), "L2_BRG: Invalid transfer proof");

        uint256 amount = _bondedWithdrawalAmounts[_transferId];
        _addToAmountWithdrawn(_rootHash, amount);

        _bondedWithdrawalAmounts[_transferId] = 0;
        _addCredit(amount);
    }

    function settleBondedWithdrawals(
        bytes32[] memory _transferIds
    )
        public
    {
        bytes32 rootHash = MerkleUtils.getMerkleRoot(_transferIds);

        TransferRoot storage transferRoot = _transferRoots[rootHash];
        require(transferRoot.total > 0, "BRG: Transfer root not found");

        uint256 totalBondsFreed = 0;
        for(uint256 i = 0; i < _transferIds.length; i++) {
            uint256 transferBondAmount = _bondedWithdrawalAmounts[_transferIds[i]];
            totalBondsFreed = totalBondsFreed.add(transferBondAmount);
        }

        uint256 newAmountWithdrawn = transferRoot.amountWithdrawn.add(totalBondsFreed);
        require(newAmountWithdrawn <= transferRoot.total, "BRG: Withdrawal exceeds TransferRoot total");
        transferRoot.amountWithdrawn = newAmountWithdrawn;

        _addCredit(totalBondsFreed);
    }

    /* ========== Internal functions ========== */

    function _markTransferSpent(bytes32 _transferId) internal {
        require(!_spentTransferIds[_transferId], "BRG: The transfer has already been withdrawn");
        _spentTransferIds[_transferId] = true;
    }

    function _addToAmountWithdrawn(
        bytes32 _transferRootId,
        uint256 _amount
    )
        internal
    {
        TransferRoot storage transferRoot = _transferRoots[_transferRootId];
        require(transferRoot.total > 0, "BRG: Transfer root not found");

        uint256 newAmountWithdrawn = transferRoot.amountWithdrawn.add(_amount);
        require(newAmountWithdrawn <= transferRoot.total, "BRG: Withdrawal exceeds TransferRoot total");

        transferRoot.amountWithdrawn = newAmountWithdrawn;
    }

    function _setTransferRoot(bytes32 _transferRootId, uint256 _amount) internal {
        require(_transferRoots[_transferRootId].total == 0, "BRG: Transfer root already set");
        require(_amount > 0, "BRG: Cannot set TransferRoot amount of 0");

        bytes32 transferRootId = getTransferRootId(_transferRootId, _amount);
        _transferRoots[transferRootId] = TransferRoot(_amount, 0);
    }

    function _setBondedWithdrawalAmount(bytes32 _transferId, uint256 _amount) internal {
        require(_bondedWithdrawalAmounts[_transferId] == 0, "BRG: Withdrawal has already been bonded");
        _bondedWithdrawalAmounts[_transferId] = _amount;
    }

    /* ========== Private functions ========== */

    /// @dev Completes the Transfer, distributes the relayer fee and marks the Transfer as spent.
    function _fulfillWithdraw(
        bytes32 _transferId,
        address _recipient,
        uint256 _amount,
        uint256 _relayerFee
    ) private {
        _markTransferSpent(_transferId);
        _transferFromBridge(_recipient, _amount.sub(_relayerFee));
        _transferFromBridge(msg.sender, _relayerFee);
    }
}
