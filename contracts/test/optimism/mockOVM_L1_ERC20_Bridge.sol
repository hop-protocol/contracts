//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0 <0.8.0;

import { ERC20 } from "./OVM_MockERC20.sol";
import { L2ERC20 } from "./mockOVM_L2_ERC20.sol";
import { iOVM_BaseCrossDomainMessenger } from "@eth-optimism/contracts/build/contracts/iOVM/bridge/iOVM_BaseCrossDomainMessenger.sol";

contract L1ERC20Bridge {
    address public l2ERC20Address;
    ERC20 public l1ERC20;
    iOVM_BaseCrossDomainMessenger public messenger;
    event Deposit(address indexed _sender, uint256 _amount);

    constructor (
        address _L1ERC20Address,
        address _L2ERC20Address,
        address _messenger
    ) public {
        l1ERC20 = ERC20(_L1ERC20Address);
        l2ERC20Address = _L2ERC20Address;
        messenger = iOVM_BaseCrossDomainMessenger(_messenger);
    }

    function setL1ERC20(
        address _l1erc20
    ) public {
        l1ERC20 = ERC20(_l1erc20);
    }

    function setL2ERC20(
        address _l2erc20
    ) public {
        l2ERC20Address = _l2erc20;
    }

    function setMessenger(
        address _messenger
    ) public {
        messenger = iOVM_BaseCrossDomainMessenger(_messenger);
    }

    function deposit(
        address _depositor,
        uint256 _amount
    ) public {
        l1ERC20.transferFrom(
            _depositor,
            address(this),
            _amount
        );

        // generate encoded calldata to be executed on L2
        bytes memory message = abi.encodeWithSignature(
            "mint(address,uint256)",
            _depositor,
            _amount
        );

        uint32 gasLimit = 2500000;
        messenger.sendMessage(l2ERC20Address, message, gasLimit);

        emit Deposit(_depositor, _amount);
    }

    function withdraw(
        address _withdrawer,
        uint256 _amount
    ) public {
        require(l2ERC20Address == messenger.xDomainMessageSender());
        require(msg.sender == address(messenger), "Only messages relayed by the L1CrossDomainMessenger can withdraw");
        l1ERC20.transfer(_withdrawer, _amount);
    }
}
