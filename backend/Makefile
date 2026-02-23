BINARY=bapperida-api
BUILD_DIR=./bin

.PHONY: build run dev test clean vet

build:
	@echo "Building $(BINARY)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY) ./cmd/api/

run: build
	@echo "Starting $(BINARY) on port $${GO_API_PORT:-8080}..."
	$(BUILD_DIR)/$(BINARY)

dev:
	@echo "Starting $(BINARY) in dev mode..."
	go run ./cmd/api/

test:
	go test ./... -v

vet:
	go vet ./...

clean:
	@rm -rf $(BUILD_DIR)

# Install air for hot-reload (optional)
install-air:
	go install github.com/air-verse/air@latest
