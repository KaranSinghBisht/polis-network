// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title AgentRegistry
/// @notice Minimal identity + metadata registry for Polis agents.
/// @dev    Maps AXL peer ID (hex-encoded ed25519 pubkey, 64 chars → bytes32) to an owner
///         address and a metadata URI (0G CID) that describes the agent. Reputation is a
///         simple monotonic counter here; richer weighting is layered on in a future version.
contract AgentRegistry {
    struct Agent {
        address owner;
        string metadataURI; // 0G CID — agent.yaml, persona, capabilities
        uint64 registeredAt;
        uint64 reputation;
    }

    /// @notice AXL peer ID → agent record. Zero owner means unregistered.
    mapping(bytes32 peerId => Agent) public agents;

    /// @notice Reverse index so a human wallet can list its agents.
    mapping(address owner => bytes32[]) private _ownerToPeers;

    /// @notice Account allowed to update reputation until ReviewerElection is wired.
    address public reputationAdmin;

    event AgentRegistered(bytes32 indexed peerId, address indexed owner, string metadataURI);
    event AgentMetadataUpdated(bytes32 indexed peerId, string metadataURI);
    event ReputationBumped(bytes32 indexed peerId, uint64 delta, uint64 newTotal);
    event ReputationAdminChanged(address indexed oldAdmin, address indexed newAdmin);

    error AlreadyRegistered();
    error EmptyMetadataURI();
    error InvalidPeerId();
    error NotOwner();
    error NotReputationAdmin();
    error UnknownAgent();

    constructor() {
        reputationAdmin = msg.sender;
    }

    /// @notice Register a new agent. msg.sender becomes the owner.
    function register(bytes32 peerId, string calldata metadataURI) external {
        if (peerId == bytes32(0)) revert InvalidPeerId();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        if (agents[peerId].owner != address(0)) revert AlreadyRegistered();
        agents[peerId] = Agent({
            owner: msg.sender,
            metadataURI: metadataURI,
            registeredAt: uint64(block.timestamp),
            reputation: 0
        });
        _ownerToPeers[msg.sender].push(peerId);
        emit AgentRegistered(peerId, msg.sender, metadataURI);
    }

    /// @notice Update metadata URI. Owner-only.
    function setMetadataURI(bytes32 peerId, string calldata metadataURI) external {
        Agent storage a = agents[peerId];
        if (a.owner == address(0)) revert UnknownAgent();
        if (a.owner != msg.sender) revert NotOwner();
        a.metadataURI = metadataURI;
        emit AgentMetadataUpdated(peerId, metadataURI);
    }

    /// @notice Bump reputation for an agent.
    function bumpReputation(bytes32 peerId, uint64 delta) external {
        if (msg.sender != reputationAdmin) revert NotReputationAdmin();
        Agent storage a = agents[peerId];
        if (a.owner == address(0)) revert UnknownAgent();
        a.reputation += delta;
        emit ReputationBumped(peerId, delta, a.reputation);
    }

    /// @notice Transfer reputation authority to PaymentRouter / ReviewerElection later.
    function setReputationAdmin(address newAdmin) external {
        if (msg.sender != reputationAdmin) revert NotReputationAdmin();
        if (newAdmin == address(0)) revert NotReputationAdmin();
        emit ReputationAdminChanged(reputationAdmin, newAdmin);
        reputationAdmin = newAdmin;
    }

    function peersOf(address owner) external view returns (bytes32[] memory) {
        return _ownerToPeers[owner];
    }

    function isRegistered(bytes32 peerId) external view returns (bool) {
        return agents[peerId].owner != address(0);
    }
}
