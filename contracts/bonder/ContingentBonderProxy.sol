// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/ExecutorLib.sol";
import "../token/ERC721Receiver.sol";
import "../blockhash/BlockHashValidator.sol";

// Hidden calldata should be packed (address,bytes5,uint40) where the address is the block hash validator,
// the bytes5 is the first five bytes of the block hash, and uint40 is the block number.

contract ContingentBonderProxy is ERC721Receiver {
    using ExecutorLib for address;

    uint256 public constant HIDDEN_CALLDATA_LENGTH = 57;
    address public immutable bonderEoa;
    address public immutable bridge;
    mapping(bytes4 => uint256) public expectedLengthPerSelector;

    modifier onlyBonderEoa {
        require(msg.sender == bonderEoa, "BP: Caller is not bonder in modifier");
        _;
    }

    constructor(
        address _bonderEoa,
        address _bridge,
        bytes4[] memory selectors,
        uint256[] memory lengthPerSelector
    ) {
        bonderEoa = _bonderEoa;
        bridge = _bridge;

        require(selectors.length == lengthPerSelector.length, "BP: Lengths do not match");
        for (uint256 i = 0; i < selectors.length; i++) {
            expectedLengthPerSelector[selectors[i]] = lengthPerSelector[i];
        }
    }

    fallback () external payable onlyBonderEoa {
        bytes memory messageData = msg.data;
        if (_isHiddenCalldata()) {
            messageData = _decodeAndValidateBlockHashData();
        }
        bridge.execute(messageData, msg.value);
    }

    receive () external payable {}

    function executeTransactions(bytes[] calldata transactions) external payable onlyBonderEoa {
        for (uint256 i = 0; i < transactions.length; i++) {
            (address to, bytes memory data, uint256 value) = abi.decode(transactions[i], (address, bytes, uint256));
            to.execute(data, value);
        }
    }

    function addExpectedLengthPerSelector(bytes4 selector, uint256 lengthPerSelector) external onlyBonderEoa {
        expectedLengthPerSelector[selector] = lengthPerSelector;
    }

    /* Internal Functions */

    function _isHiddenCalldata() internal view returns (bool) {
        uint256 expectedLength = expectedLengthPerSelector[msg.sig];
        if (
            expectedLength != 0 &&
            msg.data.length == expectedLength + HIDDEN_CALLDATA_LENGTH 
        ) {
            return true;
        }
        return false;
    }

    function _decodeAndValidateBlockHashData() internal view returns (bytes memory) {
        (bytes memory bridgeCalldata, address blockHashValidator, bytes32 blockHash, uint40 blockNum) = _decodeCalldata();
        BlockHashValidator(blockHashValidator).validateBlockHash(blockHash, blockNum);
        return bridgeCalldata;
    }

    function _decodeCalldata()
        internal
        pure
        returns (
            bytes memory bridgeCalldata,
            address blockHashValidator,
            bytes32 blockHash,
            uint40 blockNum
        )
    {
        // The correct msg.data.length is guaranteed because of the check in _isHiddenCalldata()
        bridgeCalldata = new bytes(msg.data.length - HIDDEN_CALLDATA_LENGTH);

        assembly {
            // Assign the unhidden calldata to bridgeCalldata
            calldatacopy(add(bridgeCalldata, 32), 0, sub(calldatasize(), HIDDEN_CALLDATA_LENGTH))

            // Parse the hidden calldata
            blockHashValidator := shr(96, calldataload(sub(calldatasize(), 57)))
            blockHash := calldataload(sub(calldatasize(), 37))
            blockNum := shr(216, calldataload(sub(calldatasize(), 5)))
        }
    }
}
