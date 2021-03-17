// SPDX-License-Identifier: Apache-2.0

/*
 * Copyright 2019-2020, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

pragma solidity 0.6.12;


contract GlobalInbox {

    /**
     * @notice Deposits an ERC20 token into a given Arbitrum Rollup chain
     * @dev This method requires approving this contract for transfers
     * @param chain Address of the rollup chain that the token is deposited into
     * @param erc20 L1 address of the token being deposited
     * @param to Address on the rollup chain that will receive the tokens
     * @param value Quantity of tokens being deposited
     */
    function depositERC20Message(
        address chain,
        address erc20,
        address to,
        uint256 value
    ) external {}

}
