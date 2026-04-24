.PHONY: install build test fmt clean deploy-testnet deploy-mainnet

install:
	forge install foundry-rs/forge-std --no-commit --no-git

build:
	forge build

test:
	forge test -vvv

fmt:
	forge fmt

clean:
	forge clean

# Requires PRIVATE_KEY in env.
deploy-testnet:
	forge script script/Deploy.s.sol \
	  --rpc-url gensyn_testnet \
	  --private-key $(PRIVATE_KEY) \
	  --broadcast

deploy-mainnet:
	forge script script/Deploy.s.sol \
	  --rpc-url gensyn_mainnet \
	  --private-key $(PRIVATE_KEY) \
	  --broadcast
