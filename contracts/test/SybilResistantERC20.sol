// // SPDX-License-Identifier: MIT

// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// contract SybilResistantERC20 is ERC20, ERC20Permit, Ownable {
//     uint8 immutable _decimals;
//     uint256 public rate;

//     event RateSet(uint256 indexed newRate);
//     event FeesCollected(uint256 indexed amount);

//     constructor(string memory _name, string memory _symbol, uint8 decimals_) public ERC20(_name, _symbol) ERC20Permit(_name) {
//         _decimals = decimals_;
//     }

//     function mint(address _recipient, uint256 _amount) public payable {
//         uint256 scaledMsgValue = msg.value * (10 ** decimals());
//         require(_amount * rate == scaledMsgValue, "SybilResistantERC20: invalid msg value");
//         _mint(_recipient, _amount);
//     }

//     /* ========== Owner Functions ========== */

//     function setRate(uint256 newRate) public onlyOwner {
//         rate = newRate;
//         emit RateSet(newRate);
//     }

//     function collectFees() public onlyOwner {
//         uint256 amount = address(this).balance;
//         payable(msg.sender).transfer(amount);
//         emit FeesCollected(amount);
//     }

//     function ownerMint(uint256 _amount) public onlyOwner {
//         _mint(msg.sender, _amount);
//     }

//     /* ========== Overrides ========== */

//     function decimals() public view override returns (uint8) {
//         return _decimals;
//     }
// }