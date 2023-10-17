// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/ExecutorLib.sol";
import "../libraries/SafeERC20.sol";

// Hidden calldata should be packed (address,bytes) where the address is the validator and the bytes is
// arbitrary calldata for use on the validator address.

contract ValidationBridgeProxy {
    using ExecutorLib for address;
    using SafeERC20 for IERC20;

    address public immutable bonderEoa;
    address public immutable bridge;
    mapping(bytes4 => uint256) public selectorDataLength;

    event FundsTransferred(
        address indexed recipient,
        address indexed token,
        uint256 indexed amount
    );

    modifier onlyBonderEoa {
        require(msg.sender == bonderEoa, "VBP: Caller is not bonder in modifier");
        _;
    }

    constructor(
        address _bonderEoa,
        address _bridge,
        bytes4[] memory selectors,
        uint256[] memory selectorDataLengths
    ) {
        bonderEoa = _bonderEoa;
        bridge = _bridge;

        require(selectors.length == selectorDataLengths.length, "VBP: Lengths do not match");
        for (uint256 i = 0; i < selectors.length; i++) {
            selectorDataLength[selectors[i]] = selectorDataLengths[i];
        }
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

    function _isHiddenCalldata() internal view returns (bool) {
        uint256 expectedLength = selectorDataLength[msg.sig];
        if (
            expectedLength == 0 ||
            msg.data.length <= expectedLength
        ) {
            return false;
        }

        return true;
    }

    function _decodeAndValidateCalldata() internal {
        (address validatorAddress, bytes memory validationData) = _decodeHiddenCalldata();
        require(validatorAddress.code.length > 0, "VBP: Validator address is not a contract");
        // This will revert if the function selector does not exist and the validation contract has no fallback
        validatorAddress.execute(validationData, 0);
    }

    function _decodeHiddenCalldata()
        internal
        view
        returns (address, bytes memory)
    {
        uint256 addressLength = 20;
        uint256 dataLength = 68; // validateBlockHash(bytes32, uint256)
        require(msg.data.length == selectorDataLength[msg.sig] + addressLength + dataLength, "VBP: Invalid hidden calldata length");

        // Extract hidden calldata
        uint256 dataStart = msg.data.length - dataLength;
        uint256 addressStart = dataStart - addressLength;

        bytes memory validationAddress = msg.data[addressStart:dataStart];
        bytes memory validationData = msg.data[dataStart:];

        return (
            address(uint160(bytes20(validationAddress))),
            validationData
        );
    }
}
