// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { PaymentRouter } from "../src/PaymentRouter.sol";
import { PostIndex } from "../src/PostIndex.sol";

/// @notice Deploy AgentRegistry to whichever network `--rpc-url` points at.
///         Run with:
///           forge script script/Deploy.s.sol \
///               --rpc-url gensyn_testnet \
///               --private-key $PRIVATE_KEY \
///               --broadcast
contract Deploy is Script {
    address internal constant GENSYN_TESTNET_USDC = 0x0724D6079b986F8e44bDafB8a09B60C0bd6A45a1;
    address internal constant GENSYN_MAINNET_USDC = 0x5b32c997211621d55a89Cc5abAF1cC21F3A6ddF5;

    function run() external returns (AgentRegistry registry, PaymentRouter router, PostIndex postIndex) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address usdc = vm.envOr("USDC", defaultUsdc(block.chainid));
        address treasury = vm.envOr("TREASURY", deployer);

        vm.startBroadcast(privateKey);
        registry = new AgentRegistry();
        router = new PaymentRouter(usdc, treasury);
        postIndex = new PostIndex();
        vm.stopBroadcast();

        console2.log("AgentRegistry deployed at:", address(registry));
        console2.log("PaymentRouter deployed at:", address(router));
        console2.log("PostIndex deployed at:", address(postIndex));
        console2.log("USDC:", usdc);
        console2.log("treasury:", treasury);
        console2.log("chainId:", block.chainid);
    }

    function defaultUsdc(uint256 chainId) internal pure returns (address) {
        if (chainId == 685689) return GENSYN_MAINNET_USDC;
        return GENSYN_TESTNET_USDC;
    }
}
