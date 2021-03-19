// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "../interfaces/IAllowlist.sol";

/**
 * @title Allowlist
 * @notice This contract is a registry holding information about how much each swap contract should
 * contain upto. Swap.sol will rely on this contract to determine whether the pool cap is reached and
 * also whether a user's deposit limit is reached.
 */
contract Allowlist is Ownable, IAllowlist {
    using SafeMath for uint256;

    // Represents the root node of merkle tree containing a list of eligible addresses
    bytes32 public merkleRoot;
    // Maps pool address -> maximum total supply
    mapping(address => uint256) private poolCaps;
    // Maps pool address -> maximum amount of pool token mintable per account
    mapping(address => uint256) private accountLimits;
    // Maps account address -> boolean value indicating whether it has been checked and verified against the merkle tree
    mapping(address => bool) private verified;

    event PoolCap(address indexed poolAddress, uint256 poolCap);
    event PoolAccountLimit(address indexed poolAddress, uint256 accountLimit);
    event NewMerkleRoot(bytes32 merkleRoot);

    /**
     * @notice Creates this contract and sets the PoolCap of 0x0 with uint256(0x54dd1e) for
     * crude checking whether an address holds this contract.
     * @param merkleRoot_ bytes32 that represent a merkle root node. This is generated off chain with the list of
     * qualifying addresses.
     */
    constructor(bytes32 merkleRoot_) public {
        merkleRoot = merkleRoot_;

        // This value will be used as a way of crude checking whether an address holds this Allowlist contract
        // Value 0x54dd1e has no inherent meaning other than it is arbitrary value that checks for
        // user error.
        poolCaps[address(0x0)] = uint256(0x54dd1e);
        emit PoolCap(address(0x0), uint256(0x54dd1e));
        emit NewMerkleRoot(merkleRoot_);
    }

    /**
     * @notice Returns the max mintable amount of the lp token per account in given pool address.
     * @param poolAddress address of the pool
     * @return max mintable amount of the lp token per account
     */
    function getPoolAccountLimit(address poolAddress)
        external
        view
        override
        returns (uint256)
    {
        return accountLimits[poolAddress];
    }

    /**
     * @notice Returns the maximum total supply of the pool token for the given pool address.
     * @param poolAddress address of the pool
     */
    function getPoolCap(address poolAddress)
        external
        view
        override
        returns (uint256)
    {
        return poolCaps[poolAddress];
    }

    /**
     * @notice Returns true if the given account's existence has been verified against any of the past or
     * the present merkle tree. Note that if it has been verified in the past, this function will return true
     * even if the current merkle tree does not contain the account.
     * @param account the address to check if it has been verified
     * @return a boolean value representing whether the account has been verified in the past or the present merkle tree
     */
    function isAccountVerified(address account) external view returns (bool) {
        return verified[account];
    }

    /**
     * @notice Checks the existence of keccak256(account) as a node in the merkle tree inferred by the merkle root node
     * stored in this contract. Pools should use this function to check if the given address qualifies for depositing.
     * If the given account has already been verified with the correct merkleProof, this function will return true when
     * merkleProof is empty. The verified status will be overwritten if the previously verified user calls this function
     * with an incorrect merkleProof.
     * @param account address to confirm its existence in the merkle tree
     * @param merkleProof data that is used to prove the existence of given parameters. This is generated
     * during the creation of the merkle tree. Users should retrieve this data off-chain.
     * @return a boolean value that corresponds to whether the address with the proof has been verified in the past
     * or if they exist in the current merkle tree.
     */
    function verifyAddress(address account, bytes32[] calldata merkleProof)
        external
        override
        returns (bool)
    {
        if (merkleProof.length != 0) {
            // Verify the account exists in the merkle tree via the MerkleProof library
            bytes32 node = keccak256(abi.encodePacked(account));
            if (MerkleProof.verify(merkleProof, merkleRoot, node)) {
                verified[account] = true;
                return true;
            }
        }
        return verified[account];
    }

    // ADMIN FUNCTIONS

    /**
     * @notice Sets the account limit of allowed deposit amounts for the given pool
     * @param poolAddress address of the pool
     * @param accountLimit the max number of the pool token a single user can mint
     */
    function setPoolAccountLimit(address poolAddress, uint256 accountLimit)
        external
        onlyOwner
    {
        require(poolAddress != address(0x0), "0x0 is not a pool address");
        accountLimits[poolAddress] = accountLimit;
        emit PoolAccountLimit(poolAddress, accountLimit);
    }

    /**
     * @notice Sets the max total supply of LPToken for the given pool address
     * @param poolAddress address of the pool
     * @param poolCap the max total supply of the pool token
     */
    function setPoolCap(address poolAddress, uint256 poolCap)
        external
        onlyOwner
    {
        require(poolAddress != address(0x0), "0x0 is not a pool address");
        poolCaps[poolAddress] = poolCap;
        emit PoolCap(poolAddress, poolCap);
    }

    /**
     * @notice Updates the merkle root that is stored in this contract. This can only be called by
     * the owner. If more addresses are added to the list, a new merkle tree and a merkle root node should be generated,
     * and merkleRoot should be updated accordingly.
     * @param merkleRoot_ a new merkle root node that contains a list of deposit allowed addresses
     */
    function updateMerkleRoot(bytes32 merkleRoot_) external onlyOwner {
        merkleRoot = merkleRoot_;
        emit NewMerkleRoot(merkleRoot_);
    }
}
