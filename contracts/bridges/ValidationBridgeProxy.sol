// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/ExecutorLib.sol";
import "../libraries/SafeERC20.sol";
import "../validators/IBlockHashValidator.sol";

// Hidden calldata should be packed (address,bytes) where the address is the validator and the bytes is
// arbitrary calldata for use on the validator address.

contract ValidationBridgeProxy {
    using ExecutorLib for address;
    using SafeERC20 for IERC20;

    uint256 public constant ADDRESS_LENGTH = 20;
    uint256 public constant VALIDATION_DATA_LENGTH = 68;
    address public immutable bonderEoa;
    address public immutable bridge;

    event FundsTransferred(
        address indexed recipient,
        address indexed token,
        uint256 indexed amount
    );

    modifier onlyBonderEoa {
        require(msg.sender == bonderEoa, "VBP: Caller is not bonder in modifier");
        _;
    }

    constructor(address _bonderEoa, address _bridge) {
        bonderEoa = _bonderEoa;
        bridge = _bridge;
    }

    fallback () external payable onlyBonderEoa {
        if (_isHiddenCalldata()) {
            _decodeAndValidateCalldata();
        }
        bridge.execute(msg.data, msg.value);
    }

    receive () external payable {}

    function claimFunds(address token, uint256 amount) external onlyBonderEoa {
        if (token == address(0)) {
            payable(bonderEoa).transfer(amount);
        } else {
            IERC20(token).safeTransfer(bonderEoa, amount);
        }
        emit FundsTransferred(bonderEoa, token, amount);
    }

    function approveBridge(address token, uint256 amount) external onlyBonderEoa {
        IERC20(token).approve(bridge, amount);
    }

    /* Internal Functions */

    function _isHiddenCalldata() internal pure returns (bool) {
        if (msg.data.length < VALIDATION_DATA_LENGTH + ADDRESS_LENGTH) {
            return false;
        }

        // Compare the data at the expected location of the validation selector with the actual selector
        uint256 hiddenSelectorStart = msg.data.length - VALIDATION_DATA_LENGTH;
        bytes memory hiddenSelector = msg.data[hiddenSelectorStart:];
        return IBlockHashValidator.validateBlockHash.selector == bytes4(hiddenSelector);
    }

    function _decodeAndValidateCalldata() internal {
        uint256 dataStart = msg.data.length - VALIDATION_DATA_LENGTH;
        uint256 addressStart = dataStart - ADDRESS_LENGTH;

        bytes memory validationData = msg.data[dataStart:];
        bytes memory validationAddressBytes = msg.data[addressStart:dataStart];
        address validationAddress = address(uint160(bytes20(validationAddressBytes)));

        require(validationAddress.code.length > 0, "VBP: Validation address is not a contract");
        validationAddress.execute(validationData, 0);
    }
}