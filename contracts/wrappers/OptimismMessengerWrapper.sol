// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/optimism/messengers/iOVM_L1CrossDomainMessenger.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Optimism - https://community.optimism.io/docs/
 * @notice Deployed on layer-1
 */

contract OptimismMessengerWrapper is MessengerWrapper, Ownable {

    iOVM_L1CrossDomainMessenger public immutable l1MessengerAddress;
    address public immutable l2BridgeAddress;
    uint256 public defaultL2GasLimit;
    mapping (bytes4 => uint256) public l2GasLimitForSignature;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        iOVM_L1CrossDomainMessenger _l1MessengerAddress,
        uint256 _defaultL2GasLimit
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1MessengerAddress = _l1MessengerAddress;
        defaultL2GasLimit = _defaultL2GasLimit;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        uint256 l2GasLimit = l2GasLimitForCalldata(_calldata);

        l1MessengerAddress.sendMessage(
            l2BridgeAddress,
            _calldata,
            uint32(l2GasLimit)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == address(l1MessengerAddress), "OVM_MSG_WPR: Caller is not l1MessengerAddress");
        // Verify that cross-domain sender is l2BridgeAddress
        require(l1MessengerAddress.xDomainMessageSender() == l2BridgeAddress, "OVM_MSG_WPR: Invalid cross-domain sender");
    }

    function setDefaultL2GasLimit(uint256 _l2GasLimit) external onlyOwner {
        defaultL2GasLimit = _l2GasLimit;
    }

    function setL2GasLimitForSignature(uint256 _l2GasLimit, bytes4 signature) external onlyOwner {
        l2GasLimitForSignature[signature] = _l2GasLimit;
    }

    // Private functions

    function l2GasLimitForCalldata(bytes memory _calldata) private view returns (uint256) {
        uint256 l2GasLimit;

        if (_calldata.length >= 4) {
            bytes4 functionSignature = bytes4(toUint32(_calldata, 0));
            l2GasLimit = l2GasLimitForSignature[functionSignature];
        }

        if (l2GasLimit == 0) {
            l2GasLimit = defaultL2GasLimit;
        }

        return l2GasLimit;
    }

    // source: https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
    function toUint32(bytes memory _bytes, uint256 _start) private pure returns (uint32) {
        require(_bytes.length >= _start + 4, "OVM_MSG_WPR: out of bounds");
        uint32 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x4), _start))
        }

        return tempUint;
    }
}
