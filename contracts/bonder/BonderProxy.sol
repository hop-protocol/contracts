// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/ExecutorLib.sol";
import "./token/ERC721Receiver.sol";
import "./blockHash/BlockHashValidator.sol";

contract BonderProxy is ERC721Receiver {
    using ExecutorLib for address;

    uint256 public constant HIDDEN_CALLDATA_LENGTH = 64;
    address public immutable bonderEoa;
    address public immutable bridge;
    address public immutable blockHashValidator;
    mapping(bytes4 => uint256) public expectedLengthPerSelector;

    constructor(
        address _bonderEoa,
        address _bridge,
        address _blockHashValidator,
        bytes4[] memory selectors,
        uint256[] memory lengthPerSelector
    ) {
        bonderEoa = _bonderEoa;
        bridge = _bridge;
        blockHashValidator = _blockHashValidator;

        require(selectors.length == lengthPerSelector.length, "BP: Lengths do not match");
        for (uint256 i = 0; i < selectors.length; i++) {
            expectedLengthPerSelector[selectors[i]] = lengthPerSelector[i];
        }
    }

    fallback () external payable {
        require(msg.sender == bonderEoa, "BP: Fallback caller is not bonder EOA");

        bytes memory messageData = msg.data;
        if (_isHiddenCalldata()) {
            messageData = _decodeAndValidateBlockHashData();
        }
        bridge.execute(messageData, msg.value);
    }

    receive () external payable {}

    function executeTransactions (bytes[] memory transactions) external payable {
        require(msg.sender == bonderEoa, "BP: Execute caller is not bonder EOA");
        for (uint256 i = 0; i < transactions.length; i++) {
            (address to, bytes memory data, uint256 value) = abi.decode(transactions[i], (address, bytes, uint256));
            to.execute(data, value);
        }
    }

    /* ========== Internal functions ========== */

    function _isHiddenCalldata() internal view returns (bool) {
        uint256 expectedLength = expectedLengthPerSelector[msg.sig];
        if (
            expectedLength != 0 &&
            expectedLength == msg.data.length + HIDDEN_CALLDATA_LENGTH
        ) {
            return true;
        }
        return false;
    }

    function _decodeAndValidateBlockHashData() internal view returns (bytes memory) {
        (bytes memory bridgeCalldata, bytes32 blockHash, uint256 blockNum) = _decodeCalldata();
        bool isValid = BlockHashValidator(blockHashValidator).isBlockHashValid(blockHash, blockNum);
        require(isValid, "BP: BlockHash data is invalid");
        return bridgeCalldata;
    }

    function _decodeCalldata()
        internal
        pure
        returns (bytes memory bridgeCalldata, bytes32 blockHash, uint256 blockNum)
    {
        // The correct length is guaranteed because of the check in _isHiddenCalldata()
        bridgeCalldata = new bytes(msg.data.length - HIDDEN_CALLDATA_LENGTH);

        assembly {
            // Assign the unhidden calldata to bridgeCalldata
            calldatacopy(add(bridgeCalldata, 32), 0, sub(calldatasize(), 64))

            // Parse the hidden calldata
            blockHash := calldataload(sub(calldatasize(), 64))
            blockNum := calldataload(sub(calldatasize(), 32))
        }
    }
}
