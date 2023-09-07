// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/ExecutorLib.sol";
import "../libraries/SafeERC20.sol";
import "../token/ERC721Receiver.sol";
import "../interfaces/IERC721.sol";

// Hidden calldata should be packed (address,bytes) where the address is the validator and the bytes is
// arbitrary calldata for use on the validator address.

contract ValidationBridgeProxy is ERC721Receiver {
    using ExecutorLib for address;
    using SafeERC20 for IERC20;

    uint256 public constant ADDRESS_LENGTH_BYTES = 20;
    address public immutable bonderEoa;
    address public immutable bridge;
    mapping(bytes4 => uint256) public expectedSelectorDataLength;

    event SelectorLengthAdded(
        bytes4 indexed selector,
        uint256 indexed selectorDataLength
    );
    event FundsTransferred(
        address indexed recipient,
        address indexed token,
        uint256 indexed amountOrTokenId,
        uint256 tokenType
    );

    modifier onlyBonderEoa {
        require(msg.sender == bonderEoa, "VBP: Caller is not bonder in modifier");
        _;
    }

    constructor(
        address _bonderEoa,
        address _bridge,
        bytes4[] memory selectors,
        uint256[] memory selectorDataLength
    ) {
        bonderEoa = _bonderEoa;
        bridge = _bridge;

        require(selectors.length == selectorDataLength.length, "VBP: Lengths do not match");
        for (uint256 i = 0; i < selectors.length; i++) {
            expectedSelectorDataLength[selectors[i]] = selectorDataLength[i];
        }
    }

    fallback () external payable onlyBonderEoa {
        bytes memory messageData = msg.data;
        if (_isHiddenCalldata()) {
            messageData = _decodeAndValidate();
        }
        bridge.execute(messageData, msg.value);
    }

    receive () external payable {}

    function claimFunds(address token, uint256 amountOrTokenId, uint256 tokenType) external onlyBonderEoa {
        if (tokenType == 0) {
            require(token == address(0), "VBP: Token address must be 0 for ETH transfers");
            payable(bonderEoa).transfer(amountOrTokenId);
        } else if (tokenType == 1) {
            IERC20(token).safeTransfer(bonderEoa, amountOrTokenId);
        } else if (tokenType == 2) {
            IERC721(token).safeTransferFrom(address(this), bonderEoa, amountOrTokenId);
        } else {
            revert("VBP: Invalid token type");
        }
        emit FundsTransferred(bonderEoa, token, amountOrTokenId, tokenType);
    }

    function addSelectorDataLength(bytes4 selector, uint256 selectorDataLength) external onlyBonderEoa {
        expectedSelectorDataLength[selector] = selectorDataLength;
        emit SelectorLengthAdded(selector, selectorDataLength);
    }

    /* Internal Functions */

    function _isHiddenCalldata() internal view returns (bool) {
        uint256 expectedLength = expectedSelectorDataLength[msg.sig];
        if (
            expectedLength != 0 &&
            msg.data.length >= expectedLength + ADDRESS_LENGTH_BYTES
        ) {
            return true;
        }
        return false;
    }

    function _decodeAndValidate() internal returns (bytes memory) {
        (bytes memory bridgeCalldata, address validatorAddress, bytes memory validationData) = _decodeHiddenCalldata();
        require(validatorAddress.code.length > 0, "VBP: Validator address is not a contract");
        validatorAddress.execute(validationData, 0);
        return bridgeCalldata;
    }

    function _decodeHiddenCalldata()
        internal
        view
        returns (
            bytes memory bridgeCalldata,
            address validatorAddress,
            bytes memory validationData
        )
    {
        // The correct length of calldata + address is guaranteed because of the check in _isHiddenCalldata()
        uint256 bridgeCalldataLength = expectedSelectorDataLength[msg.sig];
        uint256 bridgeCalldataWithAddressLength = bridgeCalldataLength + ADDRESS_LENGTH_BYTES;
        uint256 validationDataLength = msg.data.length - bridgeCalldataWithAddressLength;

        bridgeCalldata = new bytes(bridgeCalldataLength);
        validationData = new bytes(validationDataLength);

        assembly {
            // Assign the unhidden calldata to bridgeCalldata
            calldatacopy(add(bridgeCalldata, 32), 0, bridgeCalldataLength)

            // Parse the address from the hidden calldata
            validatorAddress := shr(96, calldataload(bridgeCalldataLength))

            // Get the validation data from the remaining hidden calldata
            calldatacopy(add(validationData, 32), bridgeCalldataWithAddressLength, validationDataLength)
        }
    }
}
