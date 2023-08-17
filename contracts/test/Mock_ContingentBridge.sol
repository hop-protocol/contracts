// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

contract Mock_ContingentBridge{
    address public bonder;
    uint256 public lastCalledFunction;

    modifier onlyBonder {
        require(msg.sender == bonder, "MCB: Not bonder");
        _;
    }

    receive () external payable {}

    function setBonder(address _bonder) public {
        bonder = _bonder;
    }

    function bondTransferRoot(
        bytes32 rootHash,
        uint256 destinationChainId,
        uint256 totalAmount
    )
        external
        onlyBonder
    {
        lastCalledFunction = 1;
    }

    function bondWithdrawal(
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 bonderFee
    )
        external
        onlyBonder
    {
        lastCalledFunction = 2;
    }

    function bondWithdrawalAndDistribute(
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline
    )
        external
        onlyBonder
    {
        lastCalledFunction = 3;
    }

    // Other functions
    function stake(address bonder, uint256 amount) external payable onlyBonder {}
}
