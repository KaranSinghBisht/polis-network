// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";

/// @notice Deploy AgentRegistry to whichever network `--rpc-url` points at.
///         Run with:
///           forge script script/Deploy.s.sol \
///               --rpc-url gensyn_testnet \
///               --private-key $PRIVATE_KEY \
///               --broadcast
contract Deploy is Script {
    function run() external returns (AgentRegistry registry) {
        vm.startBroadcast();
        registry = new AgentRegistry();
        vm.stopBroadcast();

        console2.log("AgentRegistry deployed at:", address(registry));
        console2.log("chainId:", block.chainid);
    }
}
