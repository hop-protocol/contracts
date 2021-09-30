// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory _name, string memory _symbol) public ERC20(_name, _symbol) {}

    function mint(address _recipient, uint256 _amount) public {
        _mint(_recipient, _amount);
    }

    function burn(address _recipient, uint256 _amount) public {
        _burn(_recipient, _amount);
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        require(_balances[msg.sender] >= wad);
        _burn(msg.sender, wad);
        msg.sender.transfer(wad);
    }

    receive() external payable {
        deposit();
    }
}