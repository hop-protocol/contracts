// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.18;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/access/AccessControl.sol";

// contract TestnetERC20 is ERC20, AccessControl {
//     uint256 public rate;
//     uint8 immutable _decimals;

//     uint256 public constant ONE_ETH = 10 ** 18;
//     bytes32 public constant ADMINS = keccak256("ADMINS");

//     constructor(
//         string memory _name,
//         string memory _symbol,
//         uint8 decimals_,
//         uint256 _rate
//     ) public ERC20(_name, _symbol) {
//         _decimals = decimals_;
//         rate = _rate;

//         _setRoleAdmin(ADMINS, ADMINS);
//         _setupRole(ADMINS, _msgSender());
//     }

//     function mint(address recipient, uint256 amount) public payable {
//         require(amount * ONE_ETH / rate == msg.value, "TestnetERC20: Invalid msg value");
//         _mint(recipient, amount);
//     }

//     function burn(uint256 amount) public {
//         _burn(msg.sender, amount);

//         uint256 refundAmount = amount * ONE_ETH / rate;
//         (bool success,) = _msgSender().call{value: refundAmount}(new bytes(0));
//         require(success, "TestnetERC20: refund failed");
//     }

//     function adminMint(address to, uint256 amount) external onlyRole(ADMINS) {
//         _mint(to, amount);
//     }

//     function adminBurn(uint256 amount) external onlyRole(ADMINS) {
//         _burn(_msgSender(), amount);
//     }

//     function decimals() public view override returns (uint8) {
//         return _decimals;
//     }
// }