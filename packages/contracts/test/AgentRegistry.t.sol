// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bytes32 internal constant PEER_A = bytes32(uint256(0xA));
    bytes32 internal constant PEER_B = bytes32(uint256(0xB));

    string internal constant META_A = "0g://cid/agentA";
    string internal constant META_B = "0g://cid/agentB";

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_register_storesValuesAndEmits() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit AgentRegistry.AgentRegistered(PEER_A, alice, META_A);

        vm.prank(alice);
        registry.register(PEER_A, META_A);

        (address owner, string memory uri, uint64 registeredAt, uint64 reputation) =
            registry.agents(PEER_A);
        assertEq(owner, alice);
        assertEq(uri, META_A);
        assertGt(registeredAt, 0);
        assertEq(reputation, 0);

        assertTrue(registry.isRegistered(PEER_A));
        bytes32[] memory peers = registry.peersOf(alice);
        assertEq(peers.length, 1);
        assertEq(peers[0], PEER_A);
    }

    function test_register_revertsOnDuplicate() public {
        vm.prank(alice);
        registry.register(PEER_A, META_A);

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        registry.register(PEER_A, META_B);
    }

    function test_setMetadataURI_ownerCanUpdate() public {
        vm.prank(alice);
        registry.register(PEER_A, META_A);

        vm.prank(alice);
        registry.setMetadataURI(PEER_A, META_B);

        (, string memory uri,,) = registry.agents(PEER_A);
        assertEq(uri, META_B);
    }

    function test_setMetadataURI_nonOwnerReverts() public {
        vm.prank(alice);
        registry.register(PEER_A, META_A);

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        registry.setMetadataURI(PEER_A, META_B);
    }

    function test_setMetadataURI_unknownReverts() public {
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        registry.setMetadataURI(PEER_A, META_A);
    }

    function test_bumpReputation_accumulates() public {
        vm.prank(alice);
        registry.register(PEER_A, META_A);

        registry.bumpReputation(PEER_A, 3);
        registry.bumpReputation(PEER_A, 5);

        (,,, uint64 reputation) = registry.agents(PEER_A);
        assertEq(reputation, 8);
    }

    function test_bumpReputation_unknownReverts() public {
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        registry.bumpReputation(PEER_A, 1);
    }

    function test_peersOf_multipleAgents() public {
        vm.startPrank(alice);
        registry.register(PEER_A, META_A);
        registry.register(PEER_B, META_B);
        vm.stopPrank();

        bytes32[] memory peers = registry.peersOf(alice);
        assertEq(peers.length, 2);
        assertEq(peers[0], PEER_A);
        assertEq(peers[1], PEER_B);
    }
}
