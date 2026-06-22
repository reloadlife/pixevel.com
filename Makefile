.PHONY: deploy deploy-dry build

# Build locally + configure/ship to the server via pyinfra + push schema.
deploy:
	bash deploy/deploy.sh

# Preview the pyinfra changes without applying (no schema push).
deploy-dry:
	bash deploy/deploy.sh --dry

build:
	bun run build
