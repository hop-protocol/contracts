pragma solidity >=0.5.0;

abstract contract IUniswapV2Pair {

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function MINIMUM_LIQUIDITY() virtual external pure returns (uint);
    function factory() virtual external view returns (address);
    function token0() virtual external view returns (address);
    function token1() virtual external view returns (address);
    function getReserves() virtual external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() virtual external view returns (uint);
    function price1CumulativeLast() virtual external view returns (uint);
    function kLast() virtual external view returns (uint);

    function mint(address to) virtual external returns (uint liquidity);
    function burn(address to) virtual external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) virtual external;
    function skim(address to) virtual external;
    function sync() virtual external;

    function initialize(address, address) virtual external;
}
