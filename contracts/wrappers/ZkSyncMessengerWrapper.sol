// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;
pragma experimental ABIEncoderV2;

import "../interfaces/zksync/messengers/IMailbox.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for ZKSync - https://v2-docs.zksync.io/dev/developer-guides/bridging/l1-l2.html#structure
 * @notice Deployed on layer-1
 */

contract ZkSyncMessengerWrapper is MessengerWrapper {

    IMailbox public zkSyncL1Bridge;
    address public l2BridgeAddress;
    mapping(uint32 => mapping(uint256 => bool)) public processedExits;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IMailbox _zkSyncL1Bridge,
        uint256 _l2ChainId
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
    {
        l2BridgeAddress = _l2BridgeAddress;
        zkSyncL1Bridge = _zkSyncL1Bridge;
    }

    receive() external payable {}

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        // TODO: For mainnet, verify that block.basefee is correct
        uint256 ergsLimit = 10000;
        uint256 fee = zkSyncL1Bridge.l2TransactionBaseCost(block.basefee, ergsLimit, uint32(_calldata.length)); 
        zkSyncL1Bridge.requestL2Transaction{value: fee}(
            l2BridgeAddress,
            0,
            _calldata,
            ergsLimit,
            new bytes[](0)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory) public override {
        if (isRootConfirmation) return;

        require(l1BridgeCaller == address(this), "L1_ZKSYNC_WPR: Caller must be this contract");
    }

    function consumeMessageFromL2(
        uint32 l2BlockNumber,
        uint256 index,
        uint16 l2TxNumberInBlock,
        bytes calldata message,
        bytes32[] calldata proof
    ) external {
        // TODO: For mainnet, this mapping index should be more unique. If zkSync undergoes a regenesis, it is possible that this value will
        // not be unique. Consider hashing all the input values here.
        require(!processedExits[l2BlockNumber][index], "L1_ZKSYNC_WRP: Already processed exit");

        L2Message memory l2Message = L2Message({
            txNumberInBlock: l2TxNumberInBlock,
            sender: l2BridgeAddress,
            data: message
        });

        bool success = zkSyncL1Bridge.proveL2MessageInclusion(l2BlockNumber, index, l2Message, proof);

        if (success) {
            // TODO: For mainnet, consider adding an event
            processedExits[l2BlockNumber][index] = true;
        }
    }

    /**
     * @dev Claim excess funds
     * @param recipient The recipient to send to
     * @param amount The amount to claim
     */
    function claimFunds(address payable recipient, uint256 amount) public {
        // TODO: For mainnet, if this function remains, make it ownable. Solidity version issues prevented it for testnet.
        require(msg.sender == 0xfEfeC7D3EB14a004029D278393e6AB8B46fb4FCa, "L1_ZKSYNC_WPR: Only owner can claim funds");
        recipient.transfer(amount);
    }
}
