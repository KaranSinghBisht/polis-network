// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { PostIndex } from "../src/PostIndex.sol";

contract PostIndexTest is Test {
    PostIndex internal index;

    address internal alice = makeAddr("alice");
    bytes32 internal constant PEER_A = bytes32(uint256(0xA));
    bytes32 internal constant CONTENT_HASH = keccak256("hello");

    function setUp() public {
        index = new PostIndex();
    }

    function test_recordPost_storesAndEmitsPointer() public {
        vm.expectEmit(true, true, true, true, address(index));
        emit PostIndex.PostArchived(
            0,
            PEER_A,
            alice,
            CONTENT_HASH,
            "town.general",
            "0g://root",
            uint64(block.timestamp)
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
