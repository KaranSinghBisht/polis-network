// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { PostIndex } from "../src/PostIndex.sol";

contract PostIndexTest is Test {
    AgentRegistry internal registry;
    PostIndex internal index;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    bytes32 internal constant PEER_A = bytes32(uint256(0xA));
    bytes32 internal constant CONTENT_HASH = keccak256("hello");

    function setUp() public {
        registry = new AgentRegistry();
        index = new PostIndex(address(registry));
    }

    function test_recordPost_storesAndEmitsPointer() public {
        vm.prank(alice);
        registry.register(PEER_A, "0g://agent/alice");

        vm.expectEmit(true, true, true, true, address(index));
        emit PostIndex.PostArchived(
            0, PEER_A, alice, CONTENT_HASH, "town.general", "0g://root", uint64(block.timestamp)
        );

        vm.prank(alice);
        uint256 postId = index.recordPost(PEER_A, "town.general", "0g://root", CONTENT_HASH);

        assertEq(postId, 0);
        assertEq(index.postCount(), 1);

        PostIndex.PostPointer memory post = index.postAt(0);
        assertEq(post.peerId, PEER_A);
        assertEq(post.contentHash, CONTENT_HASH);
        assertEq(post.author, alice);
        assertEq(post.topic, "town.general");
        assertEq(post.archiveURI, "0g://root");
        assertEq(post.timestamp, uint64(block.timestamp));
    }

    function test_recordPost_revertsWhenSenderDoesNotOwnPeer() public {
        vm.prank(alice);
        registry.register(PEER_A, "0g://agent/alice");

        vm.prank(bob);
        vm.expectRevert(PostIndex.NotPeerOwner.selector);
        index.recordPost(PEER_A, "town.general", "0g://root", CONTENT_HASH);
    }

    function test_recordPost_revertsWhenPeerIsUnregistered() public {
        vm.prank(alice);
        vm.expectRevert(PostIndex.NotPeerOwner.selector);
        index.recordPost(PEER_A, "town.general", "0g://root", CONTENT_HASH);
    }

    function test_constructor_revertsOnZeroRegistry() public {
        vm.expectRevert(PostIndex.InvalidRegistry.selector);
        new PostIndex(address(0));
    }

    function test_recordPost_revertsOnZeroPeer() public {
        vm.expectRevert(PostIndex.InvalidPeerId.selector);
        index.recordPost(bytes32(0), "town.general", "0g://root", CONTENT_HASH);
    }

    function test_recordPost_revertsOnEmptyTopic() public {
        vm.expectRevert(PostIndex.EmptyTopic.selector);
        index.recordPost(PEER_A, "", "0g://root", CONTENT_HASH);
    }

    function test_recordPost_revertsOnEmptyArchiveURI() public {
        vm.expectRevert(PostIndex.EmptyArchiveURI.selector);
        index.recordPost(PEER_A, "town.general", "", CONTENT_HASH);
    }
}
