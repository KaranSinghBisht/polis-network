// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { PaymentRouter } from "../src/PaymentRouter.sol";

contract PaymentRouterTest is Test {
    MockUSDC internal usdc;
    PaymentRouter internal router;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockUSDC();
        router = new PaymentRouter(address(usdc), treasury);
        usdc.mint(alice, 1_000e6);
    }

    function test_pay_sendsNetAndFee() public {
        vm.startPrank(alice);
        usdc.approve(address(router), 100e6);

        vm.expectEmit(true, true, false, true, address(router));
        emit PaymentRouter.Paid(alice, bob, 100e6, 1e6, 99e6, "scout bounty");

        (uint256 fee, uint256 net) = router.pay(bob, 100e6, "scout bounty");
        vm.stopPrank();

        assertEq(fee, 1e6);
        assertEq(net, 99e6);
        assertEq(usdc.balanceOf(bob), 99e6);
        assertEq(usdc.balanceOf(treasury), 1e6);
        assertEq(usdc.balanceOf(alice), 900e6);
    }

    function test_pay_revertsWithoutAllowance() public {
        vm.prank(alice);
        vm.expectRevert(PaymentRouter.TransferFailed.selector);
        router.pay(bob, 100e6, "");
    }

    function test_pay_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PaymentRouter.InvalidAmount.selector);
        router.pay(bob, 0, "");
    }

    function test_pay_revertsOnZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(PaymentRouter.InvalidRecipient.selector);
        router.pay(address(0), 1, "");
    }

    function test_setFeeBps_treasuryOnly() public {
        vm.prank(treasury);
        router.setFeeBps(250);

        vm.startPrank(alice);
        usdc.approve(address(router), 200e6);
        (uint256 fee, uint256 net) = router.pay(bob, 200e6, "");
        vm.stopPrank();

        assertEq(fee, 5e6);
        assertEq(net, 195e6);
    }

    function test_setFeeBps_nonTreasuryReverts() public {
        vm.prank(alice);
        vm.expectRevert(PaymentRouter.NotTreasury.selector);
        router.setFeeBps(250);
    }

    function test_setFeeBps_capsAtTenPercent() public {
        vm.prank(treasury);
        vm.expectRevert(PaymentRouter.FeeTooHigh.selector);
        router.setFeeBps(1_001);
    }

    function test_setTreasury_treasuryOnly() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(treasury);
        router.setTreasury(newTreasury);

        assertEq(router.treasury(), newTreasury);
    }
}

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
