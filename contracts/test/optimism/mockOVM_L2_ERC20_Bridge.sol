//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0 <0.8.0;

import { ERC20 } from "./OVM_MockERC20.sol";
import { iOVM_BaseCrossDomainMessenger } from "@eth-optimism/contracts/build/contracts/iOVM/bridge/iOVM_BaseCrossDomainMessenger.sol";

contract OVM_L2_ERC20_Bridge {
    address public l1ERC20BridgeAddress;
    iOVM_BaseCrossDomainMessenger public l2Messenger;
    address public l1TokenAddress;

    constructor (
        address _l2Messenger,
        address _l1ERC20BridgeAddress,
        address _l1TokenAddress
    ) public {
        l2Messenger = iOVM_BaseCrossDomainMessenger(_l2Messenger);
        l1ERC20BridgeAddress = _L1ERC20BridgeAddress;
        l1TokenAddress = _l1TokenAddress;
    }

    function withdraw(address _l2TokenAddress, uint256 _amount) public {
        ERC20(_l2TokenAddress).burn(msg.sender, _amount);

        // generate encoded calldata to be executed on L1
        bytes memory message = abi.encodeWithSignature(
            "withdraw(address,address,uint256)",
            l1TokenAddress,
            msg.sender,
            _amount
        );

        // send the message over to the L1CrossDomainMessenger
        uint32 gasLimit = 2500000;
        l2Messenger.sendMessage(l1ERC20BridgeAddress, message, gasLimit);
    }
}
