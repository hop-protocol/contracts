// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IMessengerWrapper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IL1Bridge {
    struct TransferBond {
        address bonder;
        uint256 createdAt;
        uint256 totalAmount;
        uint256 challengeStartTime;
        address challenger;
        bool challengeResolved;
    }
    uint256 public challengePeriod;
    mapping(bytes32 => TransferBond) public transferBonds;
    function getIsBonder(address maybeBonder) public view returns (bool) {}
    function getTransferRootId(bytes32 rootHash, uint256 totalAmount) public pure returns (bytes32) {}
    function confirmTransferRoot(
        uint256 originChainId,
        bytes32 rootHash,
        uint256 destinationChainId,
        uint256 totalAmount,
        uint256 rootCommittedAt
    )
        external
    {}
}

abstract contract MessengerWrapper is IMessengerWrapper, Ownable {
    address public immutable l1BridgeAddress;
    uint256 public immutable l2ChainId;
    bool public isRootConfirmation = false;
    address public relayer;
    uint256 public relayerFee;

    constructor(address _l1BridgeAddress, uint256 _l2ChainId) internal {
        l1BridgeAddress = _l1BridgeAddress;
        l2ChainId = _l2ChainId;
    }

    modifier onlyL1Bridge {
        require(msg.sender == l1BridgeAddress, "MW: Sender must be the L1 Bridge");
        _;
    }

    modifier rootConfirmation {
        isRootConfirmation = true;
        _;
        isRootConfirmation = false;
    }

    /**
     * @dev Confirm roots that have bonded on L1 and passed the challenge period with no challenge
     * @param rootHashes The root hashes to confirm
     * @param destinationChainIds The destinationChainId of the roots to confirm
     * @param totalAmounts The totalAmount of the roots to confirm
     * @param rootCommittedAts The rootCommittedAt of the roots to confirm
     */
    function confirmRoots (
        bytes32[] calldata rootHashes,
        uint256[] calldata destinationChainIds,
        uint256[] calldata totalAmounts,
        uint256[] calldata rootCommittedAts
    ) external override rootConfirmation {
        IL1Bridge l1Bridge = IL1Bridge(l1BridgeAddress);
        require(l1Bridge.getIsBonder(msg.sender), "MW: Sender must be a bonder");
        require(rootHashes.length == totalAmounts.length, "MW: rootHashes and totalAmounts must be the same length");

        uint256 challengePeriod = l1Bridge.challengePeriod();
        for (uint256 i = 0; i < rootHashes.length; i++) {
            bool canConfirm = canConfirmRoot(l1Bridge, rootHashes[i], totalAmounts[i], challengePeriod);
            require(canConfirm, "MW: Root cannot be confirmed");
            l1Bridge.confirmTransferRoot(
                l2ChainId,
                rootHashes[i],
                destinationChainIds[i],
                totalAmounts[i],
                rootCommittedAts[i]
            );
        }
    }
    
    function canConfirmRoot (IL1Bridge l1Bridge, bytes32 rootHash, uint256 totalAmount, uint256 challengePeriod) public view returns (bool) {
        bytes32 transferRootId = l1Bridge.getTransferRootId(rootHash, totalAmount);
        (,uint256 createdAt,,uint256 challengeStartTime,,) = l1Bridge.transferBonds(transferRootId);

        uint256 timeSinceBondCreation = block.timestamp - createdAt;
        if (
            createdAt != 0 &&
            challengeStartTime == 0 &&
            timeSinceBondCreation > challengePeriod
        ) {
            return true;
        }

        return false;
    }

    function validateMessage(bytes memory _calldata) public returns (bool) {
      // https://docs.soliditylang.org/en/v0.6.12/types.html#array-slices
      bytes4 sig =
          _calldata[0] |
          (bytes4(_calldata[1]) >> 8) |
          (bytes4(_calldata[2]) >> 16) |
          (bytes4(_calldata[3]) >> 24);

      if (sig == bytes4(keccak256("distribute(address,uint256,uint256,uint256,address,uint256)"))) {
        // Solidity 0.6.x only allows slicing of calldata, not memory, so use the msg.data here
        (address _relayer, uint256 _relayerFee) = abi.decode(msg.data[200:], (address, uint256));
        if (
            _relayer != relayer ||
            _relayerFee != relayerFee
        ) {
            return false;
        }
      }

      return true;
    }

    function setRelayerParams(address _relayer, uint256 _relayerFee) external onlyOwner {
        relayer = _relayer;
        relayerFee = _relayerFee;
    }
}
