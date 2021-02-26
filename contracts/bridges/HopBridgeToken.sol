import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HopBridgeToken is ERC20, Ownable {
    address public l1Governance;

    constructor (
        address _l1Governance,
        string memory name,
        string memory symbol,
        uint8 decimals
    )
        public
        ERC20(name, symbol)
    {
        l1Governance = _l1Governance;

        _setupDecimals(decimals);
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}