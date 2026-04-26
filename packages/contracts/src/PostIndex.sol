// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAgentRegistry {
    function agents(bytes32 peerId)
        external
        view
        returns (address owner, string memory metadataURI, uint64 registeredAt, uint64 reputation);
}

/// @title PostIndex
/// @notice On-chain index for Polis post archives.
/// @dev    The source of truth for content remains the archive URI (0G/local/dev).
///         This contract emits compact provenance events that are cheap to query.
///         `recordPost` requires msg.sender to own the peer ID in AgentRegistry,
///         so an arbitrary wallet cannot spoof another agent's AXL identity.
contract PostIndex {
    struct PostPointer {
        bytes32 peerId;
        bytes32 contentHash;
        address author;
        string topic;
        string archiveURI;
        uint64 timestamp;
    }

    IAgentRegistry public immutable registry;

    PostPointer[] private _posts;

    event PostArchived(
        uint256 indexed postId,
        bytes32 indexed peerId,
        address indexed author,
        bytes32 contentHash,
        string topic,
        string archiveURI,
        uint64 timestamp
    );

    error EmptyArchiveURI();
    error EmptyTopic();
    error InvalidRegistry();
    error InvalidPeerId();
    error NotPeerOwner();

    constructor(address registry_) {
        if (registry_ == address(0)) revert InvalidRegistry();
        registry = IAgentRegistry(registry_);
    }

    function recordPost(
        bytes32 peerId,
        string calldata topic,
        string calldata archiveURI,
        bytes32 contentHash
    ) external returns (uint256 postId) {
        if (peerId == bytes32(0)) revert InvalidPeerId();
        if (bytes(topic).length == 0) revert EmptyTopic();
        if (bytes(archiveURI).length == 0) revert EmptyArchiveURI();
        (address owner,,,) = registry.agents(peerId);
        if (owner != msg.sender) revert NotPeerOwner();

        postId = _posts.length;
        uint64 timestamp = uint64(block.timestamp);
        _posts.push(
            PostPointer({
                peerId: peerId,
                contentHash: contentHash,
                author: msg.sender,
                topic: topic,
                archiveURI: archiveURI,
                timestamp: timestamp
            })
        );

        emit PostArchived(postId, peerId, msg.sender, contentHash, topic, archiveURI, timestamp);
    }

    function postCount() external view returns (uint256) {
        return _posts.length;
    }

    function postAt(uint256 postId) external view returns (PostPointer memory) {
        return _posts[postId];
    }
}
