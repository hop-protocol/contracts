//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0 <0.8.0;

import { ERC20 } from "./OVM_MockERC20.sol";
import { L1ERC20Bridge } from "./mockOVM_L1_ERC20_Bridge.sol";
import { iOVM_BaseCrossDomainMessenger } from "@eth-optimism/contracts/build/contracts/iOVM/bridge/iOVM_BaseCrossDomainMessenger.sol";

contract L2ERC20 is ERC20 {
    address public l1ERC20BridgeAddress;
    iOVM_BaseCrossDomainMessenger public messenger;

    constructor(
        string memory _tokenName,
        uint8 _decimalUnits,
        string memory _tokenSymbol
    ) public ERC20(_tokenName, _tokenSymbol) {}

    function init(
        address _messenger,
        address _L1ERC20BridgeAddress
    ) public {
        require(l1ERC20BridgeAddress == address(0), "L2ERC20 instance has already been initalized");
        messenger = iOVM_BaseCrossDomainMessenger(_messenger);
        l1ERC20BridgeAddress = _L1ERC20BridgeAddress;
    }

    function setMessenger(
        address _messenger
    ) public {
        messenger = iOVM_BaseCrossDomainMessenger(_messenger);
    }

    function setERC20Bridge(
        address _L1ERC20BridgeAddress
    ) public {
        l1ERC20BridgeAddress = _L1ERC20BridgeAddress;
    }

    function mint(
      address _depositor,
      uint256 _amount
    ) public returns (bool success) {
        require(messenger.xDomainMessageSender() == l1ERC20BridgeAddress);
        require(msg.sender == address(messenger), "Only messages relayed by L2CrossDomainMessenger can mint");
        _mint(_depositor, _amount);
        return true;
    }

    function withdraw(uint256 _amount) public {
        _burn(msg.sender, _amount);
        // generate encoded calldata to be executed on L1
        bytes memory message = abi.encodeWithSignature(
            "withdraw(address,uint256)",
            msg.sender,
            _amount
        );

        // send the message over to the L1CrossDomainMessenger
        uint32 gasLimit = 2500000;
        messenger.sendMessage(l1ERC20BridgeAddress, message, gasLimit);
    }
}
